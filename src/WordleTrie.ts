import * as fs from 'fs';

export type Letter =
  'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z';
type Word = [Letter, Letter, Letter, Letter, Letter];
export type Position = 0 | 1 | 2 | 3 | 4;
type LetterMap = Record<Letter, string[]>;
type PositionMap = [LetterMap, LetterMap, LetterMap, LetterMap, LetterMap];

export type GuessState = {
  present: {
    letter: Letter,
    excludedPosition: Position[]
  }[],
  correct: {
    letter: Letter
    position: Position
  }[],
  absent: Letter[]
}

const weightMap: Record<Letter, number> = {
  e: 56.88,
  m: 15.36,
  a: 43.31,
  h: 15.31,
  r: 38.64,
  g: 12.59,
  i: 38.45,
  b: 10.56,
  o: 36.51,
  f: 9.24,
  t: 35.43,
  y: 9.06,
  n: 33.92,
  w: 6.57,
  s: 29.23,
  k: 5.61,
  l: 27.98,
  v: 5.13,
  c: 23.13,
  x: 1.48,
  u: 18.51,
  z: 1.39,
  d: 17.25,
  j: 1.01,
  p: 16.14,
  q: 1.00
}

export class WordleTrie {

  static VALID_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

  static initialLetterMap(): LetterMap {
    return WordleTrie.VALID_LETTERS.reduce<LetterMap>((p, n) => {
      p[n] = [];
      return p
    }, {} as LetterMap);
  }

  static initialGuessState(): GuessState {
    return {
      present: [],
      absent: [],
      correct: []
    };
  }

  positionMap: PositionMap = [
    WordleTrie.initialLetterMap(),
    WordleTrie.initialLetterMap(),
    WordleTrie.initialLetterMap(),
    WordleTrie.initialLetterMap(),
    WordleTrie.initialLetterMap()
  ];

  containsMap: LetterMap = WordleTrie.initialLetterMap();

  constructor(rawWords: string[], private debug = false) {
    rawWords.forEach((word) => {
      this.loadWord(this.parseRawWord(word));
    });
  }

  getHighestScoringWord(words: string[]): string {
    const scores = words
      .map(w => w.split('')
        .reduce((score, next) => score + weightMap[next], 0)
      );


    const [, maxIndx] = scores.reduce(([maxScore, maxIndx], next, indx) => next > maxScore ? [next, indx] : [maxScore, maxIndx], [0,0])

    return words[maxIndx]
  }

  parseRawWord(word: string): Word {
    if (word.length !== 5) {
      throw new Error(`${word} is not valid length (5)`);
    }
    const letters = word.split('');
    if (!letters.every(l => WordleTrie.VALID_LETTERS.includes(l))) {
      throw new Error(`${word} must only contain lowercase alpha chars`);
    }
    return letters as Word;
  }

  loadWord(word: Word): void {
    word.forEach((letter, index) => {
      const stringWord = word.join('');

      const positionMapElement = this.positionMap[index][letter];
      const containsMapElement = this.containsMap[letter];
      if (!positionMapElement.includes(stringWord)) {
        positionMapElement.push(stringWord);
      }
      if (!containsMapElement.includes(stringWord)) {
        containsMapElement.push(stringWord);
      }
    });
  }

  search(state: GuessState): string {
    const correctFilter = state.correct
      .map(({ letter, position }) => this.positionMap[position][letter])
      .reduce((prev, next) => {
        if (!prev.length) return next;
        return prev.filter((word) => next.includes(word));
      }, []);

    if (this.debug) {
      fs.writeFileSync('./correctFilter.json', JSON.stringify(correctFilter), 'utf-8');
    }

    const containsFilter = state.present
      .map(({ letter, excludedPosition }) =>
        this.containsMap[letter]
          .filter((word) => excludedPosition.every(pos => !this.positionMap[pos][letter].includes(word)))
      ).reduce((prev, next) => {
        if (prev.length === 0) return next;
        return prev.filter((word) => next.includes(word));
      }, correctFilter);

    if (this.debug) {
      fs.writeFileSync('./containsFilter.json', JSON.stringify(containsFilter), 'utf-8');
    }

    const availableWords = containsFilter.filter((word) => !state.absent.some(l => {
      const absentIndex = word.indexOf(l);
      if (absentIndex < 0) {
        return false
      }
      const isFoundAsCorrect = !state.correct.some((correct) => correct.letter === l && absentIndex === correct.position);
      const isAbsent = !state.present.some((present) => present.letter === l);
      return isFoundAsCorrect && isAbsent;
    }));

    if (this.debug) {
      fs.writeFileSync('./availableWords.json', JSON.stringify(availableWords), 'utf-8');
    }

    return this.getHighestScoringWord(availableWords);
  }
}

// import * as words from './wordle-all-words.json';
// const trie = new WordleTrie(words, true);
// const a: GuessState = {}
// console.log(trie.search(a));
