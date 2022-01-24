import * as fs from 'fs';
import { WordAnalyzer } from './WordAnalyzer';

export type Letter = 'a'|'b'|'c'|'d'|'e'|'f'|'g'|'h'|'i'|'j'|'k'|'l'|'m'|'n'|'o'|'p'|'q'|'r'|'s'|'t'|'u'|'v'|'w'|'x'|'y'|'z';
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

  constructor(public words: string[], public analyzer: WordAnalyzer, private debug = false) {
    this.words.forEach((word) => {
      this.loadWord(this.parseRawWord(word));
    });
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
      }, this.words);

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

    return this.analyzer.getTopRankedWord(availableWords);
  }
}
