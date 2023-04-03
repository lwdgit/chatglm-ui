import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs';
import { client } from "./client/src/client";
import { Message } from "@/types/chat";

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

export const GradioStream = async (req: NextApiRequest, res: NextApiResponse) => {
  const { messages = [], max_length = 2048, top_p = 0.7, temperature = 0.95, session_hash = Math.random().toString(36).substring(2) } = req.body as unknown as {
    messages: Message[],
    session_hash?: string;
    top_p?: number;
    max_length?: number;
    temperature?: number;
  };
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
    const app = await client('http://127.0.0.1:9999', session_hash);
    const isStream = req.headers['x-content-stream'];
    let hasSend = false;
    let lastContent = '';
    let lastContentLen = 0;
    //const write = throttle(res.write, 500).bind(res);
    const handleData = (event: any) => {
      lastContent = (event.data?.reverse().find((content: any) => content?.visible).value || '').replace(/�/g, '');
      if (isStream && lastContent.length > lastContentLen) {
        res.write(lastContent.slice(lastContentLen));
	// @ts-ignore
	res.flush();
	lastContentLen = lastContent.length;
      }
    };

    const handleStatus = (event: any) => {
      if (event.status === 'generating') {
        if (!hasSend) {
          hasSend = true;
          res.writeHead(200, {
            Connection: 'keep-alive',
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
        res.end(lastContent.slice(lastContentLen));
	fs.promises.appendFile('./data.json', JSON.stringify({input: message.content, output: lastContent}) + '\n', 'utf-8')
        app.off('data', handleData);
        app.off('status', handleStatus);
        resolve(true);
      }
    };

    app.on("status", handleStatus);
    app.on("data", handleData);

    app.predict('', {
      fn_index: 0,
      data: [message.content, max_length, top_p, temperature, JSON.stringify(history)],
    });

    req.connection.once('close', () => {
      console.log('request close');
      app.cancel('', 0);
    });
  })
};

export default GradioStream;

