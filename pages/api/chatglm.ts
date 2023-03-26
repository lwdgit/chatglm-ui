import { NextApiRequest, NextApiResponse } from 'next'
import GradioStream from "@/utils/gradio";
import { Message } from "@/types";

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  await GradioStream(req, res);
};

export default handler;
