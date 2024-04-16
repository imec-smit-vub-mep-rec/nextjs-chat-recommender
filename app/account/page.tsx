import { auth } from '@/auth'
import { BackButton } from '@/components/button-back'
import { Button } from '@/components/ui/button'
import { Session } from '@/lib/types'
import { kv } from '@vercel/kv'
import { revalidatePath } from 'next/cache'

export default async function Page() {
  const session = (await auth()) as Session
  const user = session?.user

  if (!user) {
    return null
  }

  // Get user history from kv
  const userHistory = await kv.get(`history:${user.email}`)

  const updateUserHistory = async (formData: FormData) => {
    'use server'
    const history = formData.get('history') as string
    // Update user history in kv
    await kv.set(`history:${user.email}`, history)

    // Confirm the history was updated: reload the page
    revalidatePath('/account')
  }

  return (
    <div>
      <BackButton />
      <div className="flex flex-col border-zinc-500  max-w-[1200px] m-auto justify-start p-5 gap-5">
        <div>
          <h1 className="text-lg mb-10">Account</h1>
          <p className='font-bold mb-3'>Edit your watching history.</p>
          <form action={updateUserHistory}>
            <div className="flex flex-col gap-5 items-center justify-between">
              <textarea
                name="history"
                className="w-full h-40 border border-zinc-500 p-2 rounded-lg"
                placeholder="Watching history"
                defaultValue={(userHistory as string) || ''}
              ></textarea>
              <Button>Save</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
