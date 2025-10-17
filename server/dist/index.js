"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const zegoServerAssistant_1 = require("./zegoServerAssistant");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// 解析JSON请求体
app.use(express_1.default.json());
// 静态文件服务，指向项目根目录的dist文件夹
const staticDir = path_1.default.join(__dirname, '../../dist');
app.use(express_1.default.static(staticDir));
// 实现/api/token接口
app.post('/api/token', (req, res) => {
    try {
        const { appId, userId, secret, effectiveTimeInSeconds = 3600, payload } = req.body;
        // 验证必需参数
        if (!appId || !userId || !secret) {
            return res.status(400).json({
                code: 400,
                message: 'appId, userId, and secret are required'
            });
        }
        // 调用generateToken04方法生成token
        const token = (0, zegoServerAssistant_1.generateToken04)(Number(appId), userId, secret, Number(effectiveTimeInSeconds), payload);
        res.json({
            code: 0,
            message: 'success',
            data: { token }
        });
    }
    catch (error) {
        res.status(500).json({
            code: 500,
            message: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});
// 捕获所有其他路由，返回index.html（支持SPA路由）
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(staticDir, 'index.html'));
});
// 执行webpack编译
function buildWebpack() {
    console.log('Starting webpack build...');
    try {
        // 在项目根目录执行webpack命令
        (0, child_process_1.execSync)('pnpm run build', {
            cwd: path_1.default.join(__dirname, '../..'),
            stdio: 'inherit'
        });
        console.log('Webpack build completed successfully');
    }
    catch (error) {
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
