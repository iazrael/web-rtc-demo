import express, { Request, Response } from 'express';
import path from 'path';
import { execSync } from 'child_process';
import { generateToken04 } from './zegoServerAssistant'

const app = express();
const PORT = process.env.PORT || 3000;

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

// 启动服务器
function startServer() {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Static files served from: ${staticDir}`);
    console.log(`Token API: POST http://localhost:${PORT}/api/token`);
  });
}

// 先执行webpack编译，然后启动服务器
buildWebpack();
startServer();