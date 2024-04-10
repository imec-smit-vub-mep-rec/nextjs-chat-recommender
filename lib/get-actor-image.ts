const imageBaseString = 'https://image.tmdb.org/t/p/w200'

export async function getActorImage(actorName: string) {
  let image = imageBaseString + '/ar33qcWbEgREn07ZpXv5Pbj8hbM.jpg' // Default to Nicolas Cage
  const url =
    `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(actorName)}&include_adult=false&language=en-US&page=1`
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
      console.log('json:', json)
      image = imageBaseString + json.results[0].profile_path
    })
    .catch(err => console.error('error:' + err))

  return image
}
