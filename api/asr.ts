import { NextApiRequest, NextApiResponse } from 'next';

// ASR回调处理函数
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method Not Allowed'
        });
    }

    try {
        console.log('收到CustomNodes请求:', req.body);

        const { UserId, MessageId, Text } = req.body.Data;

        // 参数验证
        if (!UserId || !MessageId || !Text) {
            return res.status(400).json({
                error: '缺少必要参数'
            });
        }

        // 1. 如果文本包含AddHistory, 就返回 AddHistory
        // 2. 如果文本包含CustomNodeStop, 就返回空
        // 3. 否则返回 AddHistory 和 SendLLM
        if (Text.includes('AddHistory')) {
            console.log('AddHistory');
            return res.json({
                AddHistory: {
                    Text: "添加历史:" + Text,// 将识别文本写入对话历史
                }
            });
        } else if (Text.includes('CustomNodeStop')) {
            return res.json({});
        } else {
            console.log('SendLLM');
            return res.json({
                AddHistory: {
                    Text: "小龙没说:" + Text,// 将识别文本写入对话历史
                },
                SendLLM: {
                    Text: "小龙说:嘿嘿嘿, " + Text, // 将识别文本发送给LLM处理
                    SystemPrompt: '你是刘亦菲, 喜欢小龙' // 可选的系统提示
                }
            });
        }
    } catch (error) {
        console.error('处理ASR回调失败:', error);
        return res.status(500).json({
            error: '内部服务器错误'
        });
    }
}
