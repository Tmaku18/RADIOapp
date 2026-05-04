import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Body for POST /refinery/songs/:id/review -- reviewer submits a structured review. */
export class SubmitReviewDto {
  @IsInt() @Min(1) @Max(10) overallRating!: number;
  @IsInt() @Min(1) @Max(10) beatRating!: number;
  @IsInt() @Min(1) @Max(10) lyricsRating!: number;
  @IsInt() @Min(1) @Max(10) lyricsBeatMatchRating!: number;
  @IsInt() @Min(1) @Max(10) pacingRating!: number;
  @IsInt() @Min(1) @Max(10) chorusRating!: number;
  @IsInt() @Min(1) @Max(10) openingEndingRating!: number;

  @IsObject()
  surveyResponses!: Record<string, string>;

  @IsOptional()
  @IsObject()
  customResponses?: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
