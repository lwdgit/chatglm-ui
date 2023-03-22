import { NextApiRequest, NextApiResponse } from 'next'
import GradioStream from "@/utils/gradio";
import { Message } from "@/types";

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  const { messages = [], session_hash = Math.random().toString(36).substring(2) } = req.body as unknown as {
    messages: Message[],
    session_hash?: string;
  };
  await GradioStream(messages.slice(-21), req, res, session_hash);
};

export default handler;
