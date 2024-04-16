'use client'

import { Button } from './ui/button'

export const BackButton = () => {
  const goBack = () => {
    window.history.back()
  }

  return (
    <Button onClick={goBack} variant="ghost">
      &larr; Back
    </Button>
  )
}
