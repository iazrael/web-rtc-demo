import express, { Request, Response } from 'express';
import path from 'path';
import { execSync } from 'child_process';
import { generateToken04 } from './zegoServerAssistant'
import https from 'https';
import fs from 'fs';
import os from 'os';

const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// 解析JSON请求体
app.use(express.json());

// 静态文件服务，指向项目根目录的dist文件夹
const staticDir = path.join(__dirname, '../../dist');
app.use(express.static(staticDir));

// 实现/api/token接口
app.post('/api/token', (req: Request, res: Response) => {
  try {
    const {
      appId,
      userId,
      secret,
      effectiveTimeInSeconds = 3600,
      payload
    } = req.body;

    console.log('Request body:', req.body);

    // 验证必需参数
    if (!appId || !userId || !secret) {
      return res.status(400).json({
        code: 400,
        message: 'appId, userId, and secret are required'
      });
    }

    // 调用generateToken04方法生成token
    const token = generateToken04(
      Number(appId),
      userId,
      secret,
      Number(effectiveTimeInSeconds),
      payload
    );

    res.json({
      code: 0,
      message: 'success',
      data: { token }
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// 捕获所有其他路由，返回index.html（支持SPA路由）
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// 执行webpack编译
function buildWebpack() {
  console.log('Starting webpack build...');
  try {
    // 在项目根目录执行webpack命令
    execSync('pnpm run build', {
      cwd: path.join(__dirname, '../..'),
      stdio: 'inherit'
    });
    console.log('Webpack build completed successfully');
  } catch (error) {
    console.error('Webpack build failed:', error);
    process.exit(1);
  }
}

// 启动HTTP服务器
function startHttpServer() {
  app.listen(HTTP_PORT, () => {
    console.log(`HTTP Server is running on http://localhost:${HTTP_PORT}`);
    console.log(`Static files served from: ${staticDir}`);
    console.log(`Token API: POST http://localhost:${HTTP_PORT}/api/token`);
  });
}

// 启动HTTPS服务器
function startHttpsServer() {
  try {
    // 尝试读取SSL证书和密钥
    let privateKey, certificate;
    const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '../ssl/server.key');
    const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '../ssl/server.crt');
    
    try {
      privateKey = fs.readFileSync(keyPath, 'utf8');
      certificate = fs.readFileSync(certPath, 'utf8');
    } catch (error) {
      console.warn('SSL certificates not found at specified paths. Using development certificates or falling back to HTTP.');
      console.warn('To enable HTTPS, create SSL certificates and place them in server/ssl/ directory or set SSL_KEY_PATH and SSL_CERT_PATH environment variables.');
      return false;
    }
    
    const credentials = {
      key: privateKey,
      cert: certificate
    };
    
    const httpsServer = https.createServer(credentials, app);
    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`HTTPS Server is running on https://localhost:${HTTPS_PORT}`);
      console.log(`Static files served from: ${staticDir}`);
      console.log(`Token API: POST https://localhost:${HTTPS_PORT}/api/token`);
    });
    
    return true;
  } catch (error) {
    console.error('Failed to start HTTPS server:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

// 先执行webpack编译，然后启动服务器
// buildWebpack();

// 尝试启动HTTPS服务器，如果失败则启动HTTP服务器
const httpsStarted = startHttpsServer();
if (!httpsStarted) {
  console.log('Starting HTTP server as fallback...');
  startHttpServer();
}