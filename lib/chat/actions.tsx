import 'server-only'

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  render,
  createStreamableValue
} from 'ai/rsc'
import OpenAI from 'openai'

import {
  spinner,
  BotCard,
  BotMessage,
  SystemMessage,
  Stock
} from '@/components/stocks'

import { z } from 'zod'
import { Events } from '@/components/stocks/events'
import { StocksSkeleton } from '@/components/stocks/stocks-skeleton'
import { runAsyncFnWithoutBlocking, sleep, nanoid } from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { BasicMovieInfo, Chat, Movie, RefineSearchQuery } from '@/lib/types'
import { auth } from '@/auth'
import MovieCard from './MovieCard'
import ShowRefined from './show-refined'
import { findMovieByTitleAndYear, getMovieInfo } from '../get-movie-info'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

export async function refineSearch({ query }: { query: RefineSearchQuery }) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  const purchasing = createStreamableUI(
    <div className="inline-flex items-start gap-1 md:items-center">
      {spinner}
      <p className="mb-2">
        Searching for movies with the following criteria:{' '}
        {JSON.stringify(query)}...
      </p>
    </div>
  )

  const systemMessage = createStreamableUI(null)

  runAsyncFnWithoutBlocking(async () => {
    await sleep(1000)

    purchasing.update(
      <div className="inline-flex items-start gap-1 md:items-center">
        {spinner}
        <p className="mb-2">
          Found 3 movies that match your criteria. Here are the results:
        </p>
      </div>
    )

    await sleep(1000)

    purchasing.done(
      <div>
        <p className="mb-2">
          Found 3 movies that match your criteria. Here are the results:
        </p>
      </div>
    )

    systemMessage.done(
      <SystemMessage>
        ✅ Refined your search! {JSON.stringify(query)}
      </SystemMessage>
    )

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages.slice(0, -1),
        {
          id: nanoid(),
          role: 'system',
          content: `[User has refined the search with the following criteria: ${JSON.stringify(query)}]`
        }
      ]
    })
  })

  return {
    purchasingUI: purchasing.value,
    newMessage: {
      id: nanoid(),
      display: systemMessage.value
    }
  }
}
async function submitUserMessage(content: string) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content: content + " Display your recommendations as movie cards."
      }
    ]
  })

  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const ui = render({
    model: 'gpt-3.5-turbo',
    provider: openai,
    initial: <SpinnerMessage />,
    messages: [
      {
        role: 'system',
        content: `\
You are a movie recommender bot and you can help users find the perfect movie to watch, step by step.
You and the user can discuss genres, emotions, actors and other movie data. The user can indicate which movies they have seen, and which movies seem interesting, in the UI.
Besides that, you can also chat with users about everything related to movies. Do not engage in conversations that are not related to movies or actors.

This is the rating history of the user:
1 star: ["The Conjuring", "Cabin in the woods", "Sharknado"]
2 stars: ["The Pacifier", "Scorpion King", "The Mummy"]
3 stars: ["The Fast and the Furious", "The Dark Knight", "Die Hard"]
4 stars: ["The Shawshank Redemption", "Good Will Hunting", "The Matrix", "Blade Runner"]
5 stars: ["Boyhood", "Inception", "Lady Bird", "Pulp Fiction"]

Messages inside [] means that it's a UI element or a user event. For example:
- "[User has changed the value of seen for Heat to true]" means that the user has indicated to have seen the movie in the UI.

You recommend movies based on the user's preferences, the context and the query at hand. Make sure to include also less known movies that the user might not have seen yet.
Do not recommend a movie that the user has already seen. If the user has seen all the movies that match the query, recommend a movie that is similar to the ones the user has seen.

Do NEVER mention recommended movies as plain text. Instead, show them in the UI by calling the function \`showMovies\` with the movie data:
* Introduction to the list (eg "Here are three sci-fi movies from the 80s that have a similar atmospheric and thought-provoking feel to Blade Runner:")
* The title of the film without the year
* The year of the film
* A short personal synopsis linking to the user's preferences and context
* Reasons to like the movie linking to the user's preferences and reviews; directly address the user in the reasons (say "you" instead of "some users")
* Reasons to dislike the movie linking to the user's preferences and reviews; directly address the user

If the user wants to know a list of actors that play in a movie, call \`show_movie_cast\` to show the cast.
If the user wants to complete an impossible task, respond that you are a demo and cannot do that.`
      },
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
      }))
    ],
    text: ({ content, done, delta }) => {
      if (!textStream) {
        textStream = createStreamableValue('')
        textNode = <BotMessage content={textStream.value} />
      }

      if (done) {
        textStream.done()
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content
            }
          ]
        })
      } else {
        textStream.update(delta)
      }

      return textNode
    },
    functions: {
      showMovies: {
        description: 'Display one or more movie cards.',
        parameters: z.object({
          introduction: z.string(),
          movies: z.array(
            z.object({
              title: z.string().describe('The title of the movie'),
              year: z.string().describe('The year the movie was released.'),
              synopsis: z.string().describe('The synopsis of the movie.'),
              reasons_to_like: z.array(z.string()).optional().nullable(),
              reasons_to_dislike: z.array(z.string()).optional().nullable()
            })
          )
        }),
        render: async function* ({ introduction, movies }) {
          yield (
            <BotCard>
              <StocksSkeleton />
            </BotCard>
          )

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'function',
                name: 'showMovies',
                content: JSON.stringify(movies)
              }
            ]
          })
          const movieCardsData = await getFullMovieData(movies)
          return (
            <BotCard>
              {introduction && <p className="mb-2">{introduction}</p>}
              <MovieCard props={movieCardsData} />
            </BotCard>
          )
        }
      },
      showMovieCast: {
        description:
          'List the main actors that play in the movie or do a voice.',
        parameters: z.object({
          actors: z
            .array(z.string())
            .describe('The main actors or voice actors that play in the movie.')
        }),
        render: async function* ({ actors }) {
          yield (
            <BotCard>
              <StocksSkeleton />
            </BotCard>
          )

          await sleep(1000)

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'function',
                name: 'showMovieCast',
                content: JSON.stringify(actors)
              }
            ]
          })

          return (
            <BotCard>
              <pre>{JSON.stringify(actors)}</pre>
            </BotCard>
          )
        }
      },
      /*
      showRefinedUserMessage: {
        description:
          'Display a refined user search query - only for frontend purposes.',
        parameters: z.object({}),
        render: async function* () {
          yield (
            <BotCard>
              <StocksSkeleton />
            </BotCard>
          )

          await sleep(1000)

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'function',
                name: 'showRefinedUserMessage',
                content: ''
              }
            ]
          })

          return (
            <BotCard>
              <ShowRefined />
            </BotCard>
          )
        }
      }
      */
    }
  })

  return {
    id: nanoid(),
    display: ui
  }
}

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'function' | 'data' | 'tool'
  content: string
  id: string
  name?: string
}

export type AIState = {
  chatId: string
  messages: Message[]
}

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage,
    refineSearch
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  unstable_onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState()

      if (aiState) {
        const uiState = await getUIStateFromAIState(aiState)
        return uiState
      }
    } else {
      return
    }
  },
  unstable_onSetAIState: async ({ state, done }) => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const { chatId, messages } = state

      const createdAt = new Date()
      const userId = session.user.id as string
      const path = `/chat/${chatId}`
      const title = messages[0].content.substring(0, 100)

      const chat: Chat = {
        id: chatId,
        title,
        userId,
        createdAt,
        messages,
        path
      }

      await saveChat(chat)
    } else {
      return
    }
  }
})

export const getUIStateFromAIState = async (aiState: Chat) => {
  const messages = await Promise.all(
    aiState.messages
      .filter(message => message.role !== 'system')
      .map(async (message, index) => ({
        id: `${aiState.chatId}-${index}`,
        display:
          message.role === 'function' ? (
            message.name === 'showMovies' ? (
              <BotCard>
                <MovieCard
                  props={await getFullMovieData(JSON.parse(message.content))}
                />
              </BotCard>
            ) : message.name === 'showStockPrice' ? (
              <BotCard>
                <Stock props={JSON.parse(message.content)} />
              </BotCard>
            ) : message.name === 'getEvents' ? (
              <BotCard>
                <Events props={JSON.parse(message.content)} />
              </BotCard>
            ) : null
          ) : message.role === 'user' ? (
            <UserMessage>{message.content}</UserMessage>
          ) : (
            <BotMessage content={message.content} />
          )
      }))
  )

  return messages
}

async function getFullMovieData(llmmovies: BasicMovieInfo[]) {
  const movieCardsDataPromises = llmmovies.map(async (m, n) => {
    let movie: Movie | null = await getMovieInfo(m.title, m.year) // findMovieByTitleAndYear(m.title, m.year)

    if (!movie) {
      // If not locally found, try to find it in the TMDB API
      movie = await getMovieInfo(m.title, m.year)
    }

    return {
      movie,
      llmdata: {
        title: m.title,
        year: m.year,
        synopsis: m.synopsis,
        reasons_to_like: m.reasons_to_like,
        reasons_to_dislike: m.reasons_to_dislike
      }
    }
  })

  const movieCardsData = await Promise.all(movieCardsDataPromises)

  return movieCardsData
}
