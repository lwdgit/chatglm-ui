import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs';

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const { chatid, type = 'good' } = req.query;
    if (['good', 'bad'].includes(type as string)) {
      fs.promises.rename(`./prompts/${chatid}.json`, `./prompts/${type}_${chatid}.json`);
    }
    res.end('ok');
};

export default handler;
