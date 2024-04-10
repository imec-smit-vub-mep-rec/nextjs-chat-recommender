import localMovies from '@/lib/data/movies.json'
const imageBaseString = 'https://image.tmdb.org/t/p/w200'

export async function getMovieInfo(movieName: string, year: string) {
  let movie = null

  const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(movieName)}&include_adult=false&language=en-US&page=1&year=${year}`
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      // ! Unsafe: API key should not be used in client-side code
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_TMDB_API_READ_ACCESS_TOKEN}`
    }
  }

  await fetch(url, options)
    .then(res => res.json())
    .then(json => {
      //console.log('json:', json)
      const r = json.results[0]
      const image = imageBaseString + r.poster_path

      // Now get movie details
      const detailsUrl = `https://api.themoviedb.org/3/movie/${r.id}?language=en-US&append_to_response=credits`
      return fetch(detailsUrl, options)
        .then(res => res.json())
        .then(details => {
          //console.log('details:', details)
          const director =
            details.credits.crew.filter(({ job }: any) => job === 'Director')[0]
              ?.name || 'unknown'
          movie = {
            id: '0',
            url: 'https://www.themoviedb.org/movie/' + r.id,
            Name: r.original_title,
            PosterLink: image,
            Genres: details.genres.map((g: any) => g.name)?.toString() || '',
            Actors:
              details.credits.cast
                .slice(0, 4)
                .map((a: any) => a.name)
                ?.toString() || '',
            Director: director,
            Description: r.overview,
            DatePublished: r.release_date,
            Keywords: '',
            RatingCount: r.vote_count.toString(),
            BestRating: '10.0',
            WorstRating: '1.0',
            RatingValue: r.vote_average.toString(),
            ReviewAurthor: 'Cineanalyst',
            ReviewDate: '2013-11-12',
            ReviewBody: '',
            duration: details?.runtime?.toString() || ''
          }
        })
    })
    .catch(err => console.error('error:' + err))

  return movie
}

export function findMovieByTitleAndYear(title: string, year?: string) {
  let localMovie = null

  if (year) {
    // @ts-ignore
    localMovie = localMovies.find(
      // @ts-ignore
      movie => movie.Name == title && movie.DatePublished.split('-')[0] == year
    )
  }

  if (!localMovie) {
    // Try to find a movie with the same title, regardless of the year
    // @ts-ignore
    localMovie = localMovies.find(movie => movie.Name == title)
  }

  return localMovie
}
