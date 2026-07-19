import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { REFINERY_MAX_CUSTOM_QUESTIONS } from '../refinery-questions';

/** Body for POST /refinery/songs/:id/submit -- artist submits a song to The Refinery. */
export class SubmitRefineryDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(REFINERY_MAX_CUSTOM_QUESTIONS, {
    message: `You can include at most ${REFINERY_MAX_CUSTOM_QUESTIONS} custom questions.`,
  })
  @IsString({ each: true })
  @MaxLength(280, {
    each: true,
    message: 'Each custom question must be 280 characters or fewer.',
  })
  customQuestions?: string[];
}
