import * as React from 'react'

import { shareChat } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { PromptForm } from '@/components/prompt-form'
import { ButtonScrollToBottom } from '@/components/button-scroll-to-bottom'
import { IconShare } from '@/components/ui/icons'
import { FooterText } from '@/components/footer'
import { ChatShareDialog } from '@/components/chat-share-dialog'
import { useAIState, useActions, useUIState } from 'ai/rsc'
import type { AI } from '@/lib/chat/actions'
import { nanoid } from 'nanoid'
import { UserMessage } from './stocks/message'
import localMovies from '@/lib/data/movies.json'
import { getActorImage } from '@/lib/get-actor-image'
import { useEffect } from 'react'

export interface ChatPanelProps {
  id?: string
  title?: string
  input: string
  setInput: (value: string) => void
  isAtBottom: boolean
  scrollToBottom: () => void
}

export function ChatPanel({
  id,
  title,
  input,
  setInput,
  isAtBottom,
  scrollToBottom
}: ChatPanelProps) {
  const [aiState] = useAIState()
  const [messages, setMessages] = useUIState<typeof AI>()
  const { submitUserMessage } = useActions()
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false)

  const getLocalMoviePoster = (movieName: string) => {
    // @ts-ignore
    return localMovies.find(movie => movie.Name === movieName)?.PosterLink
  }

  const defaultMessages = [
    {
      heading: 'Comedies for the whole family',
      subheading: 'Because you watched Toy Story, Shrek and Ace Ventura.',
      message: `Recommend me some comedies for the whole family like Toy Story, Shrek and Ace Ventura.`,
      image: getLocalMoviePoster('Toy Story')
    },
    {
      heading: 'Fast-paced action movies',
      subheading:
        'Because you watched The Fast and The Furious, Die Hard and Rambo.',
      message: `Recommend me some fast-paced action movies like The Fast and The Furious, Die Hard and Rambo.`,
      image: getLocalMoviePoster('Die Hard')
    },
    {
      heading: 'Directed by Greta Gerwig',
      subheading: 'Because you liked Barbie and Mistress America.',
      message: `Recommend me some movies directed or written by Greta Gerwig, like Barbie and Mistress America.`,
      image:
        'https://d27csu38upkiqd.cloudfront.net/eyJidWNrZXQiOiJmZGMtc2l0ZXB1YmxpYy1tZWRpYS1wcm9kIiwia2V5IjoidXBsb2Fkc1wvMjAyM1wvMTJcL2dnLWhlYWRzaG90LWNyZWRpdC1iZW4tcmF5bmVyLnBuZyIsImVkaXRzIjp7InJlc2l6ZSI6eyJ3aWR0aCI6MTAyOCwiZml0IjoiY292ZXIifX19'
    },
    {
      heading: 'Starring Brad Pitt',
      subheading: 'Because you liked Fight Club and Inglourious Basterds.',
      message: `Recommend me some movies starring Brad Pitt, like Fight Club and Inglourious Basterds.`,
      image: 'https://image.tmdb.org/t/p/w185/3VtEGV6jTZou9x3yY6Uz5zvRw4y.jpg'
    }
  ]

  const [exampleMessages, setExampleMessages] = React.useState(defaultMessages)

  const setActorImages = async () => {
    const exampleMessagesCopy = [...defaultMessages]
    exampleMessagesCopy[2].image = await getActorImage('Greta Gerwig')
    exampleMessagesCopy[3].image = await getActorImage('Brad Pitt')
    console.log('exampleMessagesCopy:', exampleMessagesCopy)
    setExampleMessages([...exampleMessagesCopy])
  }
  useEffect(() => {
    setActorImages()
  }, [])

  return (
    <div 
    style={{ zIndex: 99 }}
    className="fixed inset-x-0 bottom-0 w-full bg-gradient-to-b from-muted/30 from-0% to-muted/30 to-50% duration-300 ease-in-out animate-in dark:from-background/10 dark:from-10% dark:to-background/80 peer-[[data-state=open]]:group-[]:lg:pl-[250px] peer-[[data-state=open]]:group-[]:xl:pl-[300px]">
      <ButtonScrollToBottom
        isAtBottom={isAtBottom}
        scrollToBottom={scrollToBottom}
      />

      <div className="mx-auto sm:max-w-2xl sm:px-4">
        <div className="mb-4 grid grid-cols-2 gap-2 px-4 sm:px-0">
          {messages.length === 0 &&
            exampleMessages.map((example, index) => (
              <div
                key={example.heading}
                className={`flex flex-row gap-2 cursor-pointer rounded-lg border bg-white p-0 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900 ${
                  index > 1 && 'hidden md:block'
                }`}
                onClick={async () => {
                  setMessages(currentMessages => [
                    ...currentMessages,
                    {
                      id: nanoid(),
                      display: <UserMessage>{example.message}</UserMessage>
                    }
                  ])

                  const responseMessage = await submitUserMessage(
                    example.message
                  )

                  setMessages(currentMessages => [
                    ...currentMessages,
                    responseMessage
                  ])
                }}
              >
                <div>
                  {example.image && (
                    <img
                      src={example.image}
                      className="w-16 h-16 rounded-tl-lg rounded-bl-lg object-cover"
                    />
                  )}
                </div>
                <div className='flex flex-col justify-center ml-2'>
                  <div className="text-sm font-semibold">{example.heading}</div>
                  <div className="text-sm text-zinc-600">
                    {example.subheading}
                  </div>
                </div>
              </div>
            ))}
        </div>

        {messages?.length >= 2 ? (
          <div className="flex h-12 items-center justify-center">
            <div className="flex space-x-2">
              {id && title ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShareDialogOpen(true)}
                  >
                    <IconShare className="mr-2" />
                    Share
                  </Button>
                  <ChatShareDialog
                    open={shareDialogOpen}
                    onOpenChange={setShareDialogOpen}
                    onCopy={() => setShareDialogOpen(false)}
                    shareChat={shareChat}
                    chat={{
                      id,
                      title,
                      messages: aiState.messages
                    }}
                  />
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-4 border-t bg-background px-4 py-2 shadow-lg sm:rounded-t-xl sm:border md:py-4">
          <PromptForm input={input} setInput={setInput} />
          <FooterText className="hidden sm:block" />
        </div>
      </div>
    </div>
  )
}
