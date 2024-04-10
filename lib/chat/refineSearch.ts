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
  } from '@/components/stocks'
  import {
    formatNumber,
    runAsyncFnWithoutBlocking,
    sleep,
    nanoid
  } from '@/lib/utils'
  import { saveChat } from '@/app/actions'
  import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
  import { Chat } from '@/lib/types'
  import { auth } from '@/auth'
  import MovieCard from './MovieCard'
  
import { RefineSearchQuery } from "../types"

export async function refineSearch({query}: {query: RefineSearchQuery}) {
    'use server'
  
    const aiState = getMutableAIState<typeof AI>()
  
    const purchasing = createStreamableUI(
      <div className="inline-flex items-start gap-1 md:items-center">
        {spinner}
        <p className="mb-2">
          Purchasing {amount} ${symbol}...
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
            Purchasing {amount} ${symbol}... working on it...
          </p>
        </div>
      )
  
      await sleep(1000)
  
      purchasing.done(
        <div>
          <p className="mb-2">
            You have successfully purchased {amount} ${symbol}. Total cost:{' '}
            {formatNumber(amount * price)}
          </p>
        </div>
      )
  
      systemMessage.done(
        <SystemMessage>
          You have purchased {amount} shares of {symbol} at ${price}. Total cost ={' '}
          {formatNumber(amount * price)}.
        </SystemMessage>
      )
  
      aiState.done({
        ...aiState.get(),
        messages: [
          ...aiState.get().messages.slice(0, -1),
          {
            id: nanoid(),
            role: 'function',
            name: 'showStockPurchase',
            content: JSON.stringify({
              symbol,
              price,
              defaultAmount: amount,
              status: 'completed'
            })
          },
          {
            id: nanoid(),
            role: 'system',
            content: `[User has purchased ${amount} shares of ${symbol} at ${price}. Total cost = ${
              amount * price
            }]`
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