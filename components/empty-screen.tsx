import { UseChatHelpers } from 'ai/react'


export function EmptyScreen() {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="flex flex-col gap-2 rounded-lg border bg-background p-8">
        <h1 className="text-lg font-semibold">
          Welcome to the movie recommender chatbot!
        </h1>
        <p className="leading-normal text-muted-foreground">
          Ask me about movies and I&apos;ll try to recommend you something good.
        </p>
        <p className="leading-normal text-muted-foreground">
          This is demo AI chatbot to showcase an interactive and personalized interface for a conversational movie recommender.
        </p>
      </div>
    </div>
  )
}
