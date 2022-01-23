import * as puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';

import * as words from './wordle-all-words.json';
import * as commonality from '../text_data/commonality.json';
import { GuessState, Letter, Position, WordleTrie } from './WordleTrie';
import { WordAnalyzer } from './WordAnalyzer';

const MOST_COMMONLY_USED_WORDS = [
  'soare',
  'serai',
  'raise',
  'arise',
  'arose',
  'aesir',
  'osier'
];

enum TileState {
  Absent = 'absent',
  Present = 'present',
  Correct = 'correct'
}

type Tile = {
  _letter: string;
  _state: string;
};

type ValidLetter = {
  value: string;
  position: number;
  state: TileState;
}

type WordleResult = {
  result: string,
  guessedWords: string[]
};

const analyzer = new WordAnalyzer(words, commonality)
const trie = new WordleTrie(words, analyzer);

const clearRow = async (page: Page) => {
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
};

const getRow = async (page: Page, index: number) => {
  return await page.evaluate(`document.querySelector("body > game-app").shadowRoot.querySelector("#board > game-row:nth-child(${index + 1})")`);
};

const getNotInListToast = async (page: Page) => {
  return await page.evaluate(`document.querySelector("body > game-app").shadowRoot.querySelector("#game-toaster").querySelector('game-toast[text="Not in word list"]')`);
};

const getFailToast = async (page: Page) => {
  return await page.evaluate(`document.querySelector("body > game-app").shadowRoot.querySelector("#game-toaster").querySelector('game-toast[duration="Infinity"]')`);
};

const getSuccessToast = async (page: Page) => {
  return await page.evaluate(`document.querySelector("body > game-app").shadowRoot.querySelector("#game-toaster").querySelector('game-toast[duration="2000"]')`);
};

const getShareButton = async (page: Page) => {
  return await page.waitForFunction(() =>
    document.querySelector("body > game-app")?.shadowRoot.querySelector("#game > game-modal > game-stats")?.shadowRoot.querySelector("#share-button")
  );
};

const makeGuess = async (page: Page, word: string, hasGuessedMostCommon = false, guessState: GuessState, maxTries: number = 0, tryIndex: number = 0, guess: number = 0, guessedWords = []): Promise<WordleResult> => {
  await page.type('body', word);
  await page.keyboard.press('Enter');
  const fail = await getFailToast(page);
  const success = await getSuccessToast(page);

  if (success || fail) {
    const shareButton = await getShareButton(page);
    await page.waitForTimeout(1000);
    await shareButton.asElement().click();
    await page.waitForTimeout(1000);
    const result = await page.evaluate(`window.__CLIPBOARD_TEXT__`);
    return {
      result,
      guessedWords
    };
  }

  await page.waitForTimeout(2000);

  console.log('Trying "', word, '"');

  const row = await getRow(page, guess);

  const newGuessState = { ...guessState };

  Object.values(row.$tiles).forEach((tile: Tile, index: number) => {
    const letter = tile._letter as Letter;
    const position = index as Position;
    switch (tile._state) {
      case TileState.Absent:
        !newGuessState.absent.includes(letter) && newGuessState.absent.push(letter);
        break;
      case TileState.Present:
        const existing = newGuessState.present.find(p => p.letter === letter);
        if (existing) {
          !existing.excludedPosition.includes(position) && existing.excludedPosition.push(position);
        } else {
          newGuessState.present.push({ letter, excludedPosition: [position] });
        }
        break;
      case TileState.Correct:
        if (!newGuessState.correct.some((c) => c.letter === letter && c.position === position)) {
          newGuessState.correct.push({ letter, position });
        }
        break;
    }
  });

  console.log('trying next');
  const nextWord = trie.search(guessState);
  if (!nextWord) {
    throw new Error('no words left');
  }
  return makeGuess(page, nextWord, true, newGuessState, maxTries + 1, 0, guess + 1, [...guessedWords, word]);
};

type LaunchOptions = {
  headless?: boolean,
  devtools?: boolean,
  slowMo?: number,
  args?: string[]
}
export async function solve(launchOptions: LaunchOptions, startingWord?: string): Promise<WordleResult> {
  const browser = await puppeteer.launch(launchOptions);
  const pages = await browser.pages();

  const page = pages.length < 0 ? await browser.newPage() : pages[0];

  // await page.emulateTimezone('Asia/Singapore');

  // hijack the clipboard api
  browser.on('targetchanged', async (target) => {
    const targetPage = await target.page();
    const client = await targetPage.target().createCDPSession();
    await client.send('Runtime.evaluate', {
      expression: `navigator.clipboard.writeText = navigator.clipboard.write = async (contents) => { window.__CLIPBOARD_TEXT__ = contents; }`,
    });
  });

  await page.goto('https://www.powerlanguage.co.uk/wordle');

  await page.waitForTimeout(1000);

  const instructionsCloseButton = await page.evaluateHandle(`document.querySelector("body > game-app").shadowRoot.querySelector("#game > game-modal").shadowRoot.querySelector("div > div > div")`);
  await instructionsCloseButton.asElement().click();

  const result = await makeGuess(page, startingWord ?? MOST_COMMONLY_USED_WORDS[Math.floor(Math.random() * (MOST_COMMONLY_USED_WORDS.length - 1))], false, WordleTrie.initialGuessState(), 0, 0, 0)

  // await page.waitForTimeout(100000);

  await browser.close();

  return result;
}

if (require.main === module) {
  solve({
    headless: false,
    devtools: true
  })
    .then((res) => {
      console.log(res);
    });
}
