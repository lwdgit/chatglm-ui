import { NextApiRequest, NextApiResponse } from 'next'
import { client } from "./client/src/client";
import { Message } from "@/types";

function throttle(func: Function, time: number) {
  let prevTime = 0;
  return (...args: any) => {
    let nowTime = Date.now();
    if (nowTime - prevTime >= time) {
      // @ts-ignore
      func.apply(this, args);
      prevTime = nowTime;
    } 
  };
}

export const GradioStream = async (messages: Message[], req: NextApiRequest, res: NextApiResponse, session_hash: string = Math.random().toString(36).substring(2)) => {
  return new Promise(async (resolve) => {
    const message = messages.pop();
    const history = (messages || []).slice(-10)
      .reduce((prev: [string, string][], cur: Message) => {
        if (cur.role === 'user') {
          prev.push([cur.content, '']);
        } else if (cur.role === 'assistant' && prev.length) {
          prev.at(-1)![1] = cur.content;
        }
        return prev;
      }, []);

    if (!message) {
      throw new Error("content can't be empty");
    }
    const app = await client('http://127.0.0.1:7860', session_hash);
    const isStream = req.headers['x-content-stream'];
    let hasSend = false;
    let lastBuffer = Buffer.from('');
    const write = throttle(res.write, 500).bind(res);
    const handleData = (event: any) => {
      const lastContent = event.data?.reverse().find((content: any) => content?.visible).value;
      lastBuffer = Buffer.from(lastContent);
      if (isStream) {
        write(lastBuffer + '\n\n');
      }
    };

    const handleStatus = (event: any) => {
      if (event.status === 'generating') {
        if (!hasSend) {
          hasSend = true;
          res.writeHead(200, {
            Connection: 'keep-alive',
            'Content-Encoding': 'none',
            'Cache-Control': 'no-cache',
            'Content-Type': 'text/event-stream; charset=utf-8',
          });
        }
      } else if (event.status === 'error') {
        app.cancel('', 0);
        app.off('data', handleData);
        app.off('status', handleStatus);
        if (!hasSend) {
          hasSend = true;
          res.writeHead(500, {
            Connection: 'keep-alive',
            'Content-Encoding': 'none',
            'Cache-Control': 'no-cache',
            'Content-Type': 'text/event-stream',
          }).end(event.message);
          resolve(false);
        }
      } else if (event.status === 'complete') {
        res.end(lastBuffer);
        app.off('data', handleData);
        app.off('status', handleStatus);
        resolve(true);
      }
    };

    app.on("status", handleStatus);
    app.on("data", handleData);

    app.predict('', {
      fn_index: 0,
      data: [message.content, 2048, 0.7, 0.95, JSON.stringify(history)],
    });

    req.connection.once('close', () => {
      console.log('request close');
      app.cancel('', 0);
    });
  })
};

export default GradioStream;

