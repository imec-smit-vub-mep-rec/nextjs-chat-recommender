import { Message } from 'ai'

export interface Chat extends Record<string, any> {
  id: string
  title: string
  createdAt: Date
  userId: string
  path: string
  messages: Message[]
  sharePath?: string
}

export type ServerActionResult<Result> = Promise<
  | Result
  | {
      error: string
    }
>

export interface Session {
  user: {
    id: string
    email: string
  }
}

export interface AuthResult {
  type: string
  message: string
}

export interface User extends Record<string, any> {
  id: string
  email: string
  password: string
  salt: string
}

export interface BasicMovieInfo {
  title: string
  year: string
  synopsis: string
  reasons_to_like?: string[] | null
  reasons_to_dislike?: string[] | null
}
export interface Movie {
  id: string
  url: string
  Name: string
  PosterLink: string
  Genres: string
  Actors: string
  Director: string
  Description: string
  DatePublished: string
  Keywords: string
  RatingCount: string
  BestRating: string
  WorstRating: string
  RatingValue: string
  ReviewAurthor: string
  ReviewDate: string
  ReviewBody: string
  duration: string
}

export interface RefineSearchQuery {
  actors?: string[]
  genres?: string[]
  keywords?: string[]
  rating?: number
  year?: number
  duration?: number
  director?: string
  like_titles?: string[]
  language?: string
}