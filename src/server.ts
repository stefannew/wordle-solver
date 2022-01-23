import * as express from 'express'
import { solve } from './index';
import { Request } from 'express';

function createServer() {
  const app = express();

  app.use((req, res, next) => {
    if (req.get('Authorization') !== process.env.AUTH_TOKEN) {
      res.sendStatus(401);
    } else {
      next();
    }
  })

  app.get('/solve/:startingWord?', async (req: Request<{ startingWord: string }>, res) => {
    const result = await solve({ headless: true, devtools: false, args: [ '--no-sandbox'] }, req.params.startingWord);
    res.json(result);
  });

  return app;
}

const port = process.env.PORT ?? 8080;
createServer().listen(port, () => {
  console.log('listening on port', port);
});
