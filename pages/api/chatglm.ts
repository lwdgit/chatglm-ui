import { NextApiRequest, NextApiResponse } from 'next'
import GradioStream from "@/utils/gradio";

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  await GradioStream(req, res);
};

export default handler;
