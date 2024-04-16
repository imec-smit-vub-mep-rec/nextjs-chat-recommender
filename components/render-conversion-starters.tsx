'use client'
import { nanoid } from 'nanoid'
import { UserMessage } from './stocks/message'
import { getActorImage } from '@/lib/get-actor-image'
import localMovies from '@/lib/data/movies.json'
import { getMoviePoster } from '@/lib/get-movie-info'
import { useActions, useAIState, useUIState } from 'ai/rsc'
import { AI } from '@/lib/chat/actions'
import { useEffect, useState } from 'react'

type ConversationStarters = {
  heading: string
  subheading: string
  prompt: string
  image: {
    type: string // 'movie' | 'person'
    query: string
    url?: string
  }
}

interface RenderConversionStartersProps {
  starters: ConversationStarters[]
}
const getLocalMoviePoster = (movieName: string) => {
  // @ts-ignore
  return localMovies.find(movie => movie.Name === movieName)?.PosterLink
}

export function RenderConversionStarters({
  starters
}: RenderConversionStartersProps) {
  const [messages, setMessages] = useUIState<typeof AI>()
  const { submitUserMessage } = useActions()
  const [s, setS] = useState<ConversationStarters[]>([])

  const fetchImages = async () => {
    const startersWithImages = starters.map(async starter => {
      let image: string | undefined = ''
      if (starter.image.type === 'movie') {
        image = await getLocalMoviePoster(starter.image.query)

        if (!image) {
          image = await getMoviePoster(starter.image.query)
        }
      } else if (starter.image.type === 'person') {
        image = await getActorImage(starter.image.query)
      }

      return {
        ...starter,
        image: {
          ...starter.image,
          url: image
        }
      }
    })
    const swm = await Promise.all(startersWithImages)
    return swm
  }

  useEffect(() => {
    fetchImages().then(setS)
  }, [])

  if (!s || s.length < 1) {
    return null
  }

  const cards = s.map((starter, index) => (
    <div
      key={starter.heading}
      className={`flex flex-row gap-2 cursor-pointer rounded-lg border bg-white p-0 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900
      }`}
      onClick={async () => {
        setMessages((currentMessages: any) => [
          ...currentMessages,
          {
            id: nanoid(),
            display: <UserMessage>{starter.prompt}</UserMessage>
          }
        ])

        const responseMessage = await submitUserMessage(starter.prompt, true)
        console.log('✨ responseMessage: ', responseMessage)

        setMessages((currentMessages: any) => [
          ...currentMessages,
          responseMessage
        ])
      }}
    >
      <div>
        {starter.image && (
          <img
            src={starter.image.url || 'https://placehold.co/200x300'}
            className="w-16 h-16 rounded-tl-lg rounded-bl-lg object-cover"
          />
        )}
      </div>
      <div className="flex flex-col justify-center ml-2">
        <div className="text-sm font-semibold">{starter.heading}</div>
        <div className="text-sm text-zinc-600">{starter.subheading}</div>
      </div>
    </div>
  ))

  return <div className="mb-4 grid grid-cols-2 gap-2 px-4 sm:px-0">{cards}</div>
}
