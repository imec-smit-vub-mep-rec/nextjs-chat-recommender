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
import {
  BasicMovieInfo,
  Chat,
  Movie,
  RefineSearchQuery,
  Session
} from '@/lib/types'
import { auth } from '@/auth'
import MovieCard from './MovieCard'
import ShowRefined from './show-refined'
import { findMovieByTitleAndYear, getMovieInfo } from '../get-movie-info'
import { RenderConversionStarters } from '@/components/render-conversion-starters'
import { kv } from '@vercel/kv'

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
async function submitUserMessage(
  content: string,
  doShowMovieCards: boolean = false // Force to use showMovieCards function, because the model often forgets
) {
  'use server'

  console.info('🔥 submitUserMessage', content, doShowMovieCards)
  const newContent =
    content +
    (doShowMovieCards === true
      ? ' Display your recommendations as movie cards. Do not recommend movies that I have already seen.'
      : '')
    console.log('newContent', newContent)

  const aiState = getMutableAIState<typeof AI>()

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content: newContent
      }
    ]
  })

  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const session = (await auth()) as Session
  const user = session?.user
  let userHistory = null
  if (user) {
    userHistory = await kv.get(`history:${user.email}`)
  }

  const ui = render({
    model: 'gpt-3.5-turbo',
    provider: openai,
    temperature: 1.1, // Higher temp leads to more hallucinations
    initial: <SpinnerMessage />,
    messages: [
      {
        role: 'system',
        content: `\
You are a movie recommender bot and you can help users find the perfect movie to watch, step by step.
You and the user can discuss movies, genres, emotions, actors and other movie data. The user can indicate which movies they have seen, and which movies seem interesting, in the UI.
Besides that, you can also chat with users about everything related to movies. Do not engage in conversations that are not related to movies or actors.

${userHistory ? 'This is the history of the user: ' + userHistory : ''}

You recommend movies based on the user's preferences, the context and the query at hand. Make sure to include also less popular movies.
Do not recommend a movie that the user has already seen or that are already recommended in the query. If the user has seen all the movies that match the query, recommend a movie that is similar to the ones the user has seen.

Do NEVER mention recommended movies as plain text or as a list. Instead, show them in the UI by calling the function \`showMovies\` with the movie data:
* Introduction to the list (eg "Here are three sci-fi movies from the 80s that have a similar atmospheric and thought-provoking feel to Blade Runner:")
* The title of the film without the year
* The year of the film
* A short personal synopsis linking to the user's preferences and : eg "given your love for thought-provoking movies with a deep philosophical undertone, you'll love the exploration of reality in this film" -> refer to the user's preferences and watching history
* Reasons to like the movie linking to the user's preferences; directly address the user in the reasons (Write the explanation as if you was talking to someone, for example: "You may like
this and that".)
* Reasons to dislike the movie
* A JSON object indicating at least 3 themes of the movie, summing up to 1; eg {themes: [{theme: "mysterious", amount 0.4, {theme: "unheimlich atmosphere", amount: 0.4}, {theme: "melancholy", amount: 0.2}]}

When asked to generate conversation starters, provide a list of 4 conversation starters based on the user's watching history. A conversaion starter can relate to a theme, a genre, a country, a specific actor etc.
Each conversation starter should include:
* A heading (eg "Comedies for the whole family")
* A subheading (eg "Because you watched Toy Story, Shrek and Ace Ventura")
* A prompt to recommend movies in this theme (for example: "Recommend me some comedies for the whole family like Toy Story, Shrek and Ace Ventura")
* An image of a movie poster or actor related to the conversation starter, given as type (person or movie) and query (the name of the movie or actor)

If the user wants to complete a task unrelated to movies, respond that you cannot do that.
VERY IMPORTANT: do NEVER give a list of movies as plain text. Always show them in the UI by calling the function showMovies, available in tools.
`
      },
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
        //tool_choice: { type: 'function', function: { name: 'showMovies' } }
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
    tools: {
      showMovies: {
        description: 'Display one or more movie cards.',
        parameters: z.object({
          introduction: z.string(),
          movies: z.array(
            z.object({
              title: z.string().describe('The title of the movie'),
              year: z.string().describe('The year the movie was released.'),
              synopsis: z
                .string()
                .describe(
                  'A personalized synopsis of the movie based on the user preferences and watching history.'
                ),
              reasons_to_like: z.array(z.string()).optional().nullable(),
              reasons_to_dislike: z.array(z.string()).optional().nullable(),
              themes: z
                .array(
                  z.object({
                    theme: z.string().describe('The theme of the movie.'),
                    amount: z.number().describe('The amount of the theme.')
                  })
                )
                .optional()
                .nullable()
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
      generateConversationStarters: {
        description:
          'Based on the user watching history, recommend some conversation starters: themes, actors, directors, countries, ...',
        parameters: z.object({
          cards: z.array(
            z.object({
              heading: z
                .string()
                .describe(
                  'Heading of the conversation starter. For example: Comedies for the whole family.'
                ),
              subheading: z
                .string()
                .describe(
                  'Short explanation why this topic is recommended to the user. For example: Because you watched Toy Story, Shrek and Ace Ventura.'
                ),
              prompt: z
                .string()
                .describe(
                  'A prompt to act as a search in this theme. For example: Recommend me some comedies for the whole family like Toy Story, Shrek and Ace Ventura.'
                ),
              image: z.object({
                type: z.union([z.literal('movie'), z.literal('person')]),
                query: z.string().describe('The title of the movie or actor.')
              })
            })
          )
        }),
        render: async function* ({ cards }) {
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
                name: 'generateConversationStarters',
                content: JSON.stringify(cards)
              }
            ]
          })

          return (
            <BotCard>
              <RenderConversionStarters starters={cards} />
            </BotCard>
          )
        }
      }
      /*
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
      }
      */
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
              </BotCard> /*: message.name === 'showMovieCast' ? (
              <BotCard>
                <pre>{JSON.parse(message.content)}</pre>
              </BotCard>
            )*/
            ) : message.name === 'generateConversationStarters' ? (
              <BotCard>
                <RenderConversionStarters
                  starters={JSON.parse(message.content)}
                />
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
      llmdata: m
    }
  })

  const movieCardsData = await Promise.all(movieCardsDataPromises)

  return movieCardsData
}
