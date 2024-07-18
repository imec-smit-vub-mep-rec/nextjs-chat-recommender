'use client'
import Image from 'next/image'
import { BasicMovieInfo, Movie, RefineSearchQuery } from '../types'
import Accordion from './Accordion'
import { useEffect, useState } from 'react'
import { useActions, useAIState, useUIState } from 'ai/rsc'
import type { AI } from '@/lib/chat/actions'
import { nanoid } from 'nanoid'
import { UserMessage } from '@/components/stocks/message'
import PieChartComponent from '@/components/pie-chart'
import { ClockIcon, EyeOpenIcon, StarFilledIcon } from '@radix-ui/react-icons'

interface ItemCardItems {
  movie: Movie | null
  llmdata: BasicMovieInfo
}
export default function ItemCards({
  props: items
}: {
  props: ItemCardItems[]
}) {
  const [query, setQuery] = useState<RefineSearchQuery>({})
  const [messages, setMessages] = useUIState<typeof AI>()
  const { submitUserMessage } = useActions()

  const handleRefine = async () => {
    if (!query.actors && !query.director && !query.genres) return

    const userMessage = `Recommend multiple 
    ${query?.genres && query?.genres?.length > 0 ? query.genres?.toString().toLowerCase() : ''} 
    movies ${query?.actors && query?.actors?.length > 0 ? 'starring ' + query.actors?.toString() : ''} 
    ${query?.director ? 'directed by ' + query.director + ' or a similar director' : ''}
    .`

    setMessages(currentMessages => [
      ...currentMessages,
      {
        id: nanoid(),
        display: <UserMessage>{userMessage}</UserMessage>
      }
    ])
    const responseMessage = await submitUserMessage(userMessage, true)
    console.log('🚫 responseMessage: ', responseMessage)

    setMessages(currentMessages => [...currentMessages, responseMessage])
  }

  const cards = items.map((i, n) => {
    if (!i.movie) {
      return (
        <div key={'notfound-' + n}>
          Sorry, movie not found in DB <pre>{JSON.stringify(i)}</pre>
        </div>
      )
    }

    return (
      <ItemCard
        key={i.movie.id + '-' + n}
        movie={i.movie}
        llmdata={i.llmdata}
        query={query}
        setQuery={setQuery}
      />
    )
  })

  const submitQuery =
    Object.keys(query).length > 0 ? (
      <button
        onClick={handleRefine}
        className="bg-primary hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Refine search
      </button>
    ) : null

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 overflow-y-scroll pb-4 text-sm sm:flex-col">
        {cards}
        {submitQuery}
      </div>
    </div>
  )
}

function ItemCard({
  movie,
  llmdata,
  query,
  setQuery
}: {
  movie: Movie
  llmdata: BasicMovieInfo
  query: RefineSearchQuery
  setQuery: Function
}) {
  const { title, synopsis, reasons_to_like, reasons_to_dislike } = llmdata
  const id = title?.replaceAll(' ', '-')

  const [watchTrailer, setWatchTrailer] = useState(false)

  if (watchTrailer) {
    // Youtube Embed
    return (
      <YouTubeEmbed movieName={movie.Name} setWatchTrailer={setWatchTrailer} />
    )
  }

  return (
    <div className="flex items-center justify-center h-screen bg-[#0d1829] ">
      <div className="mx-auto bg-white rounded-lg shadow-xl flex">
        <div className="w-1/4 relative">
          <Image
            src={movie.PosterLink}
            alt={movie.Name}
            width={375}
            height={200}
            className="rounded-t-lg justify-center grid h-80 object-cover"
          />
        </div>

        <div className="grid rounded-lg w-3/4 max-w-[720px] shadow-sm bg-slate-100 flex-grow p-3 z-10">
          <a
            href={`${movie.PosterLink}`}
            className="group-hover:text-cyan-700 font-bold sm:text-2xl line-clamp-2"
          >
            {movie.Name} | ({movie.DatePublished.split('-')[0]})
          </a>
          <div className="flex gap-5 text-slate-400 pt-2 font-semibold">
            <div className="flex align-middle items-center gap-1">
              <StarFilledIcon
                className="inline-block w-3 h-3 text-yellow-400"
                aria-hidden="true"
              />
              {parseFloat(movie.RatingValue).toFixed(2)}
            </div>
            <div className="flex align-middle items-center gap-1">
              <ClockIcon
                className="inline-block w-3 h-3 text-yellow-400"
                aria-hidden="true"
              />{' '}
              {convertMinutesToHours(parseInt(movie.duration))}
            </div>
            <div
              className="flex align-middle items-center gap-1 hover:bg-zinc-200/40 px-2 py-1 rounded-md cursor-pointer"
              onClick={() => setWatchTrailer(true)}
            >
              <EyeOpenIcon
                className="inline-block w-3 h-3 text-yellow-400 "
                aria-hidden="true"
              />{' '}
              <span>Watch trailer</span>
            </div>
          </div>
          <div className="h-28">
            <span className="line-clamp-4 py-2 text-sm font-light leading-relaxed">
              {synopsis}{' '}
            </span>
          </div>
          <div className="my-3">
            <span className="text-sm font-semibold mr-1 ">Director:</span>
            <Badge color="orange" selected={query.director == movie.Director}>
              <input
                id={`${id}-director-${movie.Director}`}
                aria-describedby="comments-description"
                name="comments"
                type="checkbox"
                className="h-0 w-0 rounded invisible"
                checked={query.director == movie.Director}
                onChange={() => {
                  setQuery({
                    ...query,
                    director:
                      query.director === movie.Director ? '' : movie.Director
                  })
                }}
              />
              <label htmlFor={`${id}-director-${movie.Director}`}>
                {movie.Director}
              </label>
            </Badge>
          </div>
          <div className="my-4">
            <span className="text-sm font-semibold mr-1">Genres:</span>
            {movie.Genres.split(',').map((genre, index) => (
              <Badge
                color="purple"
                key={`${movie.Name}-${index}`}
                selected={query.genres?.includes(genre)}
              >
                <input
                  id={`${id}-genre-${genre}`}
                  aria-describedby="comments-description"
                  name="comments"
                  type="checkbox"
                  className="invisible"
                  checked={query.genres?.includes(genre)}
                  onChange={() => {
                    setQuery({
                      ...query,
                      genres: query.genres?.includes(genre)
                        ? query.genres?.filter(g => g !== genre)
                        : [...(query.genres || []), genre]
                    })
                  }}
                />
                <label htmlFor={`${id}-genre-${genre}`}>{genre}</label>
              </Badge>
            ))}
          </div>
          <div className="my-3">
            <span className="text-sm font-semibold mr-1">Actors:</span>
            {movie.Actors.split(',').map((actor, index) => (
              <Badge
                color="pink"
                selected={query.actors?.includes(actor)}
                key={`${movie.Name}-actor-${index}`}
              >
                <input
                  id={`${id}-actor-` + actor}
                  aria-describedby="comments-description"
                  name="comments"
                  type="checkbox"
                  className="invisible"
                  checked={query.actors?.includes(actor)}
                  onChange={() => {
                    setQuery({
                      ...query,
                      actors: query.actors?.includes(actor)
                        ? query.actors?.filter(a => a !== actor)
                        : [...(query.actors || []), actor]
                    })
                  }}
                />
                <label htmlFor={`${id}-actor-` + actor}>{actor}</label>
              </Badge>
            ))}
          </div>
          <div>
            <Accordion
              items={[
                {
                  title: 'Neutral description',
                  content: movie.Description
                },
                /*{ title: 'Reviews summary', content: movie.ReviewBody },
                { title: 'Thematics', content: movie.Keywords },*/
                {
                  title: 'Why you may like it',
                  content: reasons_to_like || ''
                },
                ...(reasons_to_dislike
                  ? [
                      {
                        title: 'Why you may not like it',
                        content: reasons_to_dislike || ''
                      }
                    ]
                  : []),
                {
                  title: 'Themes',
                  content: <PieChartComponent themes={llmdata.themes || []} />
                }
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const Badge = ({
  color = 'gray',
  selected,
  children
}: {
  color: string
  selected?: boolean
  children: any
}) => {
  const backGroundColor = selected ? 'bg-primary' : `bg-muted`
  const textColor = selected ? 'text-white' : `text-black`
  return (
    <span
      className={`inline-flex items-center rounded-full ${backGroundColor} px-2 py-1 text-xs font-medium ${textColor} ring-1 ring-inset ring-${color}`}
    >
      {children}
    </span>
  )
}

// Convert minutes to hours and minutes
const convertMinutesToHours = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

const YouTubeEmbed = ({
  movieName,
  setWatchTrailer
}: {
  movieName: string
  setWatchTrailer: Function
}) => {
  const [trailer, setTrailer] = useState<string | null>(null)
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_READ_ACCESS_TOKEN
  // Fetch the trailer from the TMDB API
  const fetchTrailer = async (movieName: string) => {
    const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(movieName)}&include_adult=false&language=en-US&page=1`
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${apiKey}`
      }
    }
    fetch(url, options)
      .then(response => response.json())
      .then(data => {
        // Check if any results were returned
        if (data.results && data.results.length > 0) {
          // Assuming the first result is the one we want
          const movie = data.results[0]

          // Now fetch the videos for this movie
          const url = `https://api.themoviedb.org/3/movie/${movie.id}/videos?language=en-US`
          const options = {
            method: 'GET',
            headers: {
              accept: 'application/json',
              Authorization: `Bearer ${apiKey}`
            }
          }

          return fetch(url, options)
        } else {
          console.log('No results found for the movie:', movieName)
          return Promise.reject('No results found')
        }
      })
      .then(response => response.json())
      .then(videoData => {
        // Check if any videos were returned
        if (videoData.results && videoData.results.length > 0) {
          // Assuming the first video is the trailer
          const trailer = videoData.results[0]

          // Get the YouTube key for the trailer
          const youtubeKey = trailer.key

          const trailerUrl = `https://www.youtube.com/embed/${youtubeKey}`
          console.log('Trailer URL:', trailerUrl)
          setTrailer(trailerUrl)
        } else {
          console.log('No trailer found for the movie:', movieName)
        }
      })
      .catch(error => {
        console.error('Error fetching data:', error)
      })
  }

  useEffect(() => {
    console.log('Fetching trailer for:', movieName)
    setTrailer(null)
    fetchTrailer(movieName)
  }, [movieName])

  if (!trailer) {
    return <span className="h-[315px] text-center">Loading...</span>
  }

  return (
    <div className="flex flex-col">
      <button onClick={() => setWatchTrailer(false)}>&larr; Back</button>
      <iframe
        width="560"
        height="315"
        src={trailer}
        title={movieName}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
      ></iframe>
    </div>
  )
}
