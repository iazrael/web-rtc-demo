const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const internalIp = require('internal-ip');
const entry = {
    'assistDev': './src/assistDev/index.js',
    'common': './src/common.js',
    'content': './src/content.js'
};
const htmlPlugins = [
    new HtmlWebpackPlugin({
        template: './src/assistDev/index.html',
        chunks: ['assistDev', 'common', 'content'],
        filename: 'assistDev/index.html',
    })
];

module.exports = {
    entry,
    mode: 'development',
    output: {
        filename: '[name]/[name].bundle.js',
        path: path.resolve(__dirname, 'docs'),
        libraryTarget: "umd",
        umdNamedDefine: true,
        globalObject: "typeof self !== 'undefined' ? self : this"
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            url: false,
                        },
                    },
                ],
            },
            {
                test: /\.(gif|png|jpe?g|svg)$/i,
                use: [
                    {
                        loader: 'url-loader',
                        options: {
                            limit: 8192,
                            name: '[name].[ext]',
                            fallback: 'file-loader', //超过了限制大小调用回调函数
                            outputPath: 'public/images', //图片存储的地址
                        },
                    },
                ],
            },
            {
                test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
                use: [
                    {
                        loader: 'url-loader',
                        options: {
                            limit: 10000, // 小于10000 ／ 1024 kb的字体会被url-loader压缩成base64格式
                            name: 'static/font/[name].[hash:7].[ext]', // 字体名字，7位哈希值，扩展名
                        },
                    },
                ],
            },
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },

        ],
    },
    plugins: [
        ...htmlPlugins,
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery',
            'window.$': 'jquery',
            'window.jQuery': 'jquery',
        }),
    ],
    devServer: {
        contentBase: './docs',
        port: 9092,
        host: internalIp.v4.sync(),
        https: true,
        open: true,
    },
};
