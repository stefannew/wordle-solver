import * as unzipper from 'unzipper';
import * as fs from 'fs';
import * as path from 'path';
import { Letter } from './WordleTrie';
import { Transform } from 'stream';

type LetterCounts = Record<Letter, number>;

const valid_letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

class FilterFor5LetterAlphaWords extends Transform {
  _transform(chunk, enc, done) {
    const words = chunk.toString('utf8').split(/\s+/g);
    const processedChunk = words
      .filter(w => w.length === 5 || w.length === 6 && w.charAt(5) === 's')
      .map(w => w.toLowerCase())
      .map(w => w.length === 6 ? w.slice(0, 5) : w)
      .filter(w => w.split('').every(c => valid_letters.includes(c)))
      .join(' ');
    done(null, processedChunk);
  }
}

export class WordAnalyzer {
  static initLetterCounts(): LetterCounts {
    return valid_letters.reduce<LetterCounts>((p, n) => {
      p[n] = 0;
      return p;
    }, {} as LetterCounts);
  }

  letterCounts: LetterCounts[];

  constructor(
    public words: string[],
    public wordCommonality: Record<string, number> = {}
  ) {
    this.letterCounts = this.letterCountByPosition();
  }

  // this is used to generate the text_data/commonality.json file
  async loadAllCommonalities() {
    // downloaded from https://www.corpusdata.org/iweb_samples.asp
    const rootDir = path.resolve(__dirname, '../text_data');
    const dirContents = fs.readdirSync(rootDir, { withFileTypes: false });
    for (const file of dirContents) {
      let fileName = file.toString();
      if (fileName.endsWith('.zip')) {
        console.log(`loading commonalities from zip: ${fileName}`);
        await this.loadWordCommonality(path.resolve(rootDir, fileName));
      }
    }
    fs.writeFileSync(path.resolve(rootDir, 'commonality.json'), JSON.stringify(this.wordCommonality));
  }

  async loadWordCommonality(filename: string) {
    const zip = fs.createReadStream(filename)
      .pipe(unzipper.Parse({ forceStream: true }));

    for await (const entry of zip) {
      const wordStream = entry.pipe(new FilterFor5LetterAlphaWords())
      wordStream.on('data', (data) => {
        const words = data.toString().split(' ');
        words.forEach((word) => {
          if (this.words.includes(word)) {
            this.wordCommonality[word] = this.wordCommonality.hasOwnProperty(word) ? this.wordCommonality[word] + 1 : 1;
          }
        });
      });
    }
  }

  letterCountByPosition(): LetterCounts[] {
    return [0, 1, 2, 3, 4].map((position) =>
      this.words.reduce<LetterCounts>((counts, word) => {
        const letter = word.charAt(position) as Letter;
        counts[letter]++;
        return counts;
      }, WordAnalyzer.initLetterCounts())
    );
  }

  calculateScore(word: string): number {
    const positionScore = word.split('')
      .reduce((score, char, position) => score + this.letterCounts[position][char], 0);
    const commonalityScore = this.wordCommonality[word] || 0.5; // base score is 0.5 to prevent multplying by 0

    // TODO: figure out something better than just multiplying these... was a random used calculation
    return positionScore * commonalityScore;
  }

  getTopRankedWord(words: string[]): string | undefined {
    if (words.length === 0) {
      return undefined;
    }
    const scores = words.map(w => this.calculateScore(w));

    const [, maxIndex] = scores.reduce((curr, score, indx) => curr[0] < score ? [score, indx] : curr, [0, 0]);

    // console.log(words)
    // console.log(scores)

    return words[maxIndex];
  }
}
