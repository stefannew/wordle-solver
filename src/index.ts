import * as puppeteer from 'puppeteer';
import { Page } from 'puppeteer';

// import * as words from './words.json';

import * as words from './wordle-words.json';

const MOST_COMMONLY_USED_LETTERS = ['a', 'e', 's', 'o', 'r', 'i', 'l', 't'];
const MOST_COMMONLY_USED_WORDS = [
  // 'aries',
  // 'orias',
  // 'serio',
  'serai',
  'oreas',
  'seora',
  'raise',
  'ireos',
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
  return await page.evaluateHandle(`document.querySelector("body > game-app").shadowRoot.querySelector("#game > game-modal > game-stats").shadowRoot.querySelector("#share-button")`);
};

const getWord = (validLetters: ValidLetter[], invalidLetters: string[], guessedWords: string[], tryIndex: number = 0) => {
  const map = new Map();
  const filteredValidLetters = [];

  console.log(invalidLetters);
  console.log(validLetters);
  console.log(filteredValidLetters);

  validLetters.forEach(letter => {

  });

  const filteredWords = words
    .filter(word => word.split('').every(letter => !invalidLetters.includes(letter)))
    .filter(word => !guessedWords.includes(word));

  console.log('wordlist length', filteredWords.length);

  filteredWords.find(word => {
    let correct = 0;
    let present = 0;

    validLetters.forEach(({ value, position, state }) => {
      if (state === TileState.Correct) {
        if (word.includes(value, position)) {
          correct += 1;
        }
      }

      if (state === TileState.Present) {
        if (word.includes(value)) {
          present += 1;
        }
      }
    });

    if (correct > 0 || present > 0) {
      map.set(word, {
        correct,
        present
      });
    }
  });

  const ordered = Array.from(map.entries()).sort((a, b) => {
    if (b[1].correct > 0) {
      return b[1].correct - a[1].correct;
    }

    if (b[1].present > 0) {
      return b[1].present - a[1].present;
    }
  });

  console.log(ordered);

  return ordered[tryIndex][0];
}

const makeGuess = async (page: Page, word: string, hasGuessedMostCommon = false, validLetters: Array<ValidLetter>, invalidLetters: string[], maxTries: number = 0, tryIndex: number = 0, guess: number = 0, guessedWords = []) => {
  await page.type('body', word);
  await page.keyboard.press('Enter');
  const notInAcceptableWordlist = await getNotInListToast(page);
  const fail = await getFailToast(page);
  const success = await getSuccessToast(page);

  if (fail) {
    console.error('Failure.');
    process.exit(0);
  }

  if (success) {
    await page.waitForTimeout(3000);

    const shareButton = await getShareButton(page);
    await shareButton.asElement().click();
    process.exit(0);
  }

  await page.waitForTimeout(2000);

  console.log('Trying "', word, '"');

  if (notInAcceptableWordlist) {
    await clearRow(page);

    if (maxTries > 10) { // FIXME remove this when we're done
      console.log('Exceeded maxTries:', maxTries);
      return; // Bailing early to test logic
    }

    console.log('word "', word, '" was not in the word list');
    if (!hasGuessedMostCommon) {
      const mostCommonlyUsedWordIndex = MOST_COMMONLY_USED_WORDS.findIndex(value => value === word);

      if (mostCommonlyUsedWordIndex === MOST_COMMONLY_USED_WORDS.length - 1) {
        console.log('Exhausted all the most commonly used words');
        const nextWord = getWord(validLetters, invalidLetters, guessedWords, tryIndex);
        console.log('Trying next word', nextWord);
        return makeGuess(page, nextWord, true, validLetters, invalidLetters, maxTries + 1, tryIndex + 1, guess, [...guessedWords, word]);
      }

      return makeGuess(page, MOST_COMMONLY_USED_WORDS[mostCommonlyUsedWordIndex + 1], hasGuessedMostCommon, validLetters, invalidLetters,maxTries + 1, tryIndex + 1, guess, [...guessedWords, word]);
    } else {
      console.log('trying next');
      const nextWord = getWord(validLetters, invalidLetters, guessedWords, tryIndex + 1);
      return makeGuess(page, nextWord, true, validLetters, invalidLetters, maxTries + 1, tryIndex + 1, guess, [...guessedWords, word]);
    }
  }

  const row = await getRow(page, guess);

  Object.values(row.$tiles).forEach((tile: Tile, index: number) => {
    switch (tile._state) {
      case TileState.Absent:
        // Yo, let's pass `invalidLetters`, too - we can just ignore any words without these
        invalidLetters = [...invalidLetters, tile._letter];
        break;
      case TileState.Present:
        validLetters.push({ value: tile._letter, position: index, state: TileState.Present });
        break;
      case TileState.Correct:
        validLetters.push({ value: tile._letter, position: index, state: TileState.Correct });
        break;
    }
  });

  console.log('trying next');
  const nextWord = getWord(validLetters, invalidLetters, [...guessedWords, word], 0);
  return makeGuess(page, nextWord, true, validLetters, invalidLetters, maxTries + 1, 0, guess + 1, [...guessedWords, word]);
};

(async() => {

  const browser = await puppeteer.launch({
    headless: false,
    // slowMo: 500,
    devtools: true
  });

  const page = await browser.newPage();

  await page.goto('https://www.powerlanguage.co.uk/wordle');

  await page.waitForTimeout(1000);

  const instructionsCloseButton = await page.evaluateHandle(`document.querySelector("body > game-app").shadowRoot.querySelector("#game > game-modal").shadowRoot.querySelector("div > div > div")`);
  await instructionsCloseButton.asElement().click();

  await makeGuess(page, MOST_COMMONLY_USED_WORDS[0], false, [], [], 0, 0, 0);
  await browser.close();
})();
