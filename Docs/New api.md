/anime 
	`Returns 50 anime entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
		- genres
		- tags
	cursor pagination on id
/anime/filters
	`Returns all available catalog filters for anime`
		- statuses
		- formats
		- genres
		- tags
		- years
		- months
		- seasons
		- country	
/anime/:animeId
	`fetch overview data by id`
	- 16 characters (main have priority)
	- all 3 titles
	- cover, bannerImage
	- description
	- hashtag
	- countryOfOrigin
	- episodeCount
	- episodeDuration
	- startDateYear/month/day
	- endDateYear/month/day
	- genres
	- tags
	- source
	- format
	- status
	- seasonSeason
	- seasonYear
	- averageScore
	- favorites
	- popularity
	- isAdult
	- synonyms
	- themeSongs
	- ageRating
	- ageRatingGuide
	- nextAiringEpisodeNumber
	- nextAiringAt
	- updatedAt
	- id
	- anilistId
	- malId
	- aniDBId
	- tvDBId
	- bangumiId
	- kitsuId
	- studios
	- trailers
	- externalLinks
/anime/:animeId/similar
	`Returns 24 most similar entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
		- genres
		- tags
/anime/:animeId/relations 
	`fetch relations for anime`
		- id
		- sourceType
		- sourceId
		- targetType
		- targetId
		- type
		- data
			- id
			- all 3 titles
			- cover, bannerImage
			- averageScore
			- format
			- status
			- startDateYear
			- description
			- genres
			- tags
/anime/:animeId/characters
	`Fetch all characters for anime`
		- actorId
		- animeId
		- characterId
		- id
		- mediaId
		- mediaType
		- role
		- characterData
			- id
			- age
			- dateOfBirthDay/month/year
			- description
			- gender
			- image
			- nameNative
			- namePrimary
		- actorData    
			- id
			- language
			- namePrimary
			- nameNative
			- image
			- description
/anime/:animeId/staff
	`fetch all staff for anime`
		- animeId
		- customRole
		- id
		- mediaId
		- mediaType
		- personId
		- role
		- personData
			- description
			- id
			- gender
			- image
			- language
			- nameAlternative
			- nameNative
			- namePrimary
/anime/:animeId/episodes
	`Fetch all episodes`
		- airDate
		- animeId
		- description
		- duration
		- edEnd
		- edStart
		- id
		- isFiller
		- isRecap
		- number
		- opEnd
		- opStart
		- recapEnd
		- recapStart
		- streamLinks
		- thumbnail
		- titleNative/primary/secondary
		- type
		- skipTimestamps
/anime/:animeId/images
	`fetch all images`
		- mal
		- anilist
		- thetvdb
/anime/:animeId/stats
	`fetch stats`
		- averageScore
		- alAverageScore
		- alPopularity
		- alFavorites
		- malPopularity
		- malFavorites
		- malAverageScore
		- scoreDistribution
		- statusDistribution
		- favorites
/anime/:animeId/friends
	`Return list of all friends that have this anime in list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/anime/:animeId/people
	`Return list of all people that have this anime in their list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/anime/:animeId/recommendations
	`Return all recommendations for this anime`
		- Empty for now

/manga 
	`Returns 50 manga entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
		- genres
		- tags
	cursor pagination on id
/manga/filters
	`Returns all available catalog filters for manga`
		- statuses
		- formats
		- genres
		- tags
		- years
		- months
		- country
/manga/:mangaId
	`Fetch overview data for manga`
	- id
	- 16 characters (main have priority)
	- all 3 titles
	- cover, bannerImage
	- description
	- countryOfOrigin
	- chapterCount
	- volumeCount
	- startDateYear/month/day
	- endDateYear/month/day
	- genres
	- tags
	- source
	- format
	- status
	- averageScore
	- favorites
	- popularity
	- isAdult
	- synonyms
	- ageRating
	- ageRatingGuide
	- updatedAt
	- anilistId
	- bangumiId
	- kitsuId
	- malId
	- mangaUpdatesId
	- externalLinks
/manga/:mangaId/similar
	`Returns 24 most similar entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
		- genres
		- tags
/manga/:mangaId/relations
	`fetch relations for manga`
		- id
		- sourceType
		- sourceId
		- targetType
		- targetId
		- type
		- data
			- id
			- all 3 titles
			- cover, bannerImage
			- averageScore
			- format
			- status
			- startDateYear
			- description
			- genres
			- tags
/manga/:mangaId/characters
	`Fetch all characters for manga`
		- mangaId
		- characterId
		- id
		- mediaId
		- mediaType
		- role
		- characterData
			- id
			- age
			- dateOfBirthDay/month/year
			- description
			- gender
			- image
			- nameNative
			- namePrimary
/manga/:mangaId/staff
	`fetch all staff for manga`
		- mangaId
		- customRole
		- id
		- mediaId
		- mediaType
		- personId
		- role
		- personData
			- description
			- id
			- gender
			- image
			- language
			- nameAlternative
			- nameNative
			- namePrimary
/manga/:mangaId/images
	`fetch all images`
		- mal
		- anilist
/manga/:mangaId/stats
	`fetch all stats`
		- averageScore
		- alAverageScore
		- alPopularity
		- alFavorites
		- malPopularity
		- malFavorites
		- malAverageScore
		- scoreDistribution
		- statusDistribution
		- favorites
/manga/:mangaId/friends
	`Return list of all friends that have this manga in list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- secondaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/manga/:mangaId/people
	`Return list of all people that have this manga in list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- secondaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/manga/:mangaId/recommendations
	`Return all recommendations for this manga`
		- Empty for now

/tv 
	`Returns 50 tv entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
		- genres
		- tags
	cursor pagination on id
/tv/filters
	`Returns all available catalog filters for tv`
		- statuses
		- formats
		- genres
		- tags
		- years
		- months
		- seasons
		- country
		- networks
/tv/:tvId
	`fetch overview data by id`
		- id
		- 16 characters (main have priority)
		- all 3 titles
		- cover, bannerImage
		- description
		- originalLanguage
		- countryOfOrigin
		- episodeCount
		- seasonCount
		- episodeDuration
		- startDateYear/month/day
		- endDateYear/month/day
		- broadcastTime
		- broadcastDays
		- genres
		- tags
		- networks
		- format
		- status
		- averageScore
		- favorites
		- popularity
		- isAdult
		- synonyms
		- ageRating
		- ageRatingGuide
		- nextAiringEpisodeNumber
		- nextAiringAt
		- updatedAt
		- tvDBId
		- tmdbId
		- imdbId
		- simklId
		- tvmazeId
		- studios
		- trailers
		- externalLinks
/tv/:tvId/similar
	`Returns 24 most similar entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
		- genres
		- tags
/tv/:tvId/relations
	`fetch relations for tv`
		- id
		- sourceType
		- sourceId
		- targetType
		- targetId
		- type
		- data
			- id
			- all 3 titles
			- cover, bannerImage
			- averageScore
			- format
			- status
			- startDateYear
			- description
			- genres
			- tags
/tv/:tvId/characters
	`Fetch all characters for tv`
		- id
		- mediaId
		- mediaType
		- characterId
		- actorId
		- role
		- characterData
			- id
			- age
			- dateOfBirthDay/month/year
			- description
			- gender
			- image
			- nameNative
			- namePrimary
		- actorData
			- id
			- language
			- namePrimary
			- nameNative
			- image
			- description
/tv/:tvId/staff
	`fetch all staff for tv`
		- id
		- mediaId
		- mediaType
		- personId
		- role
		- customRole
		- personData
			- id
			- namePrimary
			- nameNative
			- nameAlternative
			- image
			- gender
			- language
			- description
/tv/:tvId/seasons
	`Fetch all seasons for tv`
		- id
		- tvId
		- seasonNumber
		- titlePrimary
		- titleSecondary
		- description
		- posterImage
		- airDateYear/month/day
		- episodeCount
		- trailers
/tv/:tvId/episodes
	`Fetch all episodes`
		- airDate
		- description
		- duration
		- edEnd
		- edStart
		- episodeNumber
		- id
		- isFiller
		- isRecap
		- opEnd
		- opStart
		- rating
		- recapEnd
		- recapStart
		- seasonId
		- seasonNumber
		- skipTimestamps
		- streamLinks
		- thumbnail
		- titleNative/primary/secondary
		- tvId
		- type
/tv/:tvId/images
	`fetch all images`
		- thetvdb
		- tmdb
		- imdb
/tv/:tvId/stats
	`fetch stats`
		- averageScore
		- favorites
		- popularity
		- scoreDistribution
		- statusDistribution
		- imdbRating
		- imdbVotes
		- tvmazeRating
		- rottenTomatoesScore
/tv/:tvId/friends
	`Return list of all friends that have this tv in list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- secondaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/tv/:tvId/people
	`Return list of all people that have this tv in their list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- secondaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/tv/:tvId/recommendations
	`Return all recommendations for this tv`
		- Empty for now

/movies
	`Returns 50 movie entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
		- genres
		- tags
	cursor pagination on id
/movies/filters
	`Returns all available catalog filters for movies`
		- statuses
		- formats
		- genres
		- tags
		- years
		- months
		- country
/movies/:movieId
	`fetch overview data by id`
		- id
		- 16 characters (main have priority)
		- all 3 titles
		- cover, bannerImage
		- description
		- originalLanguage
		- countryOfOrigin
		- duration
		- budget
		- revenue
		- startDateYear/month/day
		- genres
		- tags
		- format
		- status
		- averageScore
		- favorites
		- popularity
		- isAdult
		- synonyms
		- ageRating
		- ageRatingGuide
		- updatedAt
		- tmdbId
		- imdbId
		- tvDBId
		- simklId
		- studios
		- trailers
		- externalLinks
/movies/:movieId/similar
	`Returns 24 most similar entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
		- genres
		- tags
/movies/:movieId/relations
	`fetch relations for movie`
		- id
		- sourceType
		- sourceId
		- targetType
		- targetId
		- type
		- data
			- id
			- all 3 titles
			- cover, bannerImage
			- averageScore
			- format
			- status
			- startDateYear
			- description
			- genres
			- tags
/movies/:movieId/characters
	`Fetch all characters for movie`
		- id
		- mediaId
		- mediaType
		- characterId
		- actorId
		- role
		- characterData
			- id
			- age
			- dateOfBirthDay/month/year
			- description
			- gender
			- image
			- nameNative
			- namePrimary
		- actorData
			- id
			- language
			- namePrimary
			- nameNative
			- image
			- description
/movies/:movieId/staff
	`fetch all staff for movie`
		- id
		- mediaId
		- mediaType
		- personId
		- role
		- customRole
		- personData
			- id
			- namePrimary
			- nameNative
			- nameAlternative
			- image
			- gender
			- language
			- description
/movies/:movieId/images
	`fetch all images`
		- tmdb
		- imdb
		- thetvdb
/movies/:movieId/stats
	`fetch stats`
		- averageScore
		- favorites
		- popularity
		- scoreDistribution
		- statusDistribution
		- imdbRating
		- imdbVotes
/movies/:movieId/friends
	`Return list of all friends that have this movie in list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/movies/:movieId/people
	`Return list of all people that have this movie in their list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/movies/:movieId/recommendations
	`Return all recommendations for this movie`
		- Empty for now

/games 
	`Returns 50 game entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
		- genres
		- tags
	cursor pagination on id
/games/filters
	`Returns all available catalog filters for games`
		- statuses
		- formats
		- genres
		- tags
		- platforms
		- years
		- developers
		- publishers
/games/:gameId
	`fetch overview data by id`
		- id
		- 16 characters (main have priority)
		- all 3 titles
		- cover, bannerImage
		- description
		- platforms
		- developers
		- publishers
		- franchise
		- gameModes
		- playerPerspectives
		- startDateYear/month/day
		- genres
		- tags
		- format
		- status
		- averageScore
		- favorites
		- popularity
		- isAdult
		- synonyms
		- ageRating
		- ageRatingGuide
		- averagePlaytime
		- requirements
		- languages
		- controllerSupport
		- steamDeckStatus
		- updatedAt
		- igdbId
		- steamAppId
		- rawgId
		- giantbombId
		- vndbId
		- studios
		- trailers
		- externalLinks
/games/:gameId/similar
	`Returns 24 most similar entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
		- genres
		- tags
/games/:gameId/relations
	`fetch relations for game`
		- id
		- sourceType
		- sourceId
		- targetType
		- targetId
		- type
		- data
			- id
			- all 3 titles
			- cover, bannerImage
			- averageScore
			- format
			- status
			- startDateYear
			- description
			- genres
			- tags
/games/:gameId/characters
	`Fetch all characters for game`
		- id
		- mediaId
		- mediaType
		- characterId
		- actorId
		- role
		- characterData
			- id
			- age
			- dateOfBirthDay/month/year
			- description
			- gender
			- image
			- nameNative
			- namePrimary
		- actorData
			- id
			- language
			- namePrimary
			- nameNative
			- image
			- description
/games/:gameId/staff
	`fetch all staff for game`
		- id
		- mediaId
		- mediaType
		- personId
		- role
		- customRole
		- personData
			- id
			- namePrimary
			- nameNative
			- nameAlternative
			- image
			- gender
			- language
			- description
/games/:gameId/images
	`fetch all images`
		- igdb
		- steam
		- rawg
/games/:gameId/stats
	`fetch stats`
		- averageScore
		- favorites
		- popularity
		- scoreDistribution
		- statusDistribution
		- igdbRating
		- igdbRatingCount
		- averagePlaytime
/games/:gameId/friends
	`Return list of all friends that have this game in list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/games/:gameId/people
	`Return list of all people that have this game in their list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/games/:gameId/recommendations
	`Return all recommendations for this game`
		- Empty for now

/music
	`Returns 50 music entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
		- genres
		- tags
	cursor pagination on id
/music/filters
	`Returns all available catalog filters for music`
		- statuses
		- formats
		- genres
		- tags
		- years
/music/:musicId
	`fetch overview data by id`
		- id
		- type
		- all 3 titles
		- titleVersion
		- cover, bannerImage
		- description
		- duration
		- trackPosition
		- diskNumber
		- startDateYear/month/day
		- genres
		- tags
		- format
		- status
		- label
		- nbTracks
		- explicitLyrics
		- audioPreviewUrl
		- bpm
		- artistId
		- artistName
		- artist
			- id
			- namePrimary
			- nameNative
			- image
			- description
		- albumId
		- averageScore
		- favorites
		- popularity
		- listeners
		- playCount
		- isAdult
		- updatedAt
		- deezerId
		- isrc
		- upc
		- spotifyId
		- externalLinks
/music/:musicId/similar
	`Returns 24 most similar entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
		- genres
		- tags
/music/:musicId/relations
	`fetch relations for music`
		- id
		- sourceType
		- sourceId
		- targetType
		- targetId
		- type
		- data
			- id
			- all 3 titles
			- cover, bannerImage
			- averageScore
			- format
			- status
			- startDateYear
			- description
			- genres
			- tags
/music/:musicId/tracks
	`Fetch all tracks for album`
		- id
		- trackPosition
		- diskNumber
		- titlePrimary
		- titleSecondary
		- duration
		- audioPreviewUrl
		- explicitLyrics
		- artistName
/music/:musicId/lyrics
	`Fetch lyrics for track`
		- id
		- lyrics
		- syncedLyrics
		- lyricsSource
/music/:musicId/staff
	`fetch all staff for music`
		- id
		- mediaId
		- mediaType
		- personId
		- role
		- customRole
		- personData
			- id
			- namePrimary
			- nameNative
			- nameAlternative
			- image
			- gender
			- language
			- description
/music/:musicId/images
	`fetch all images`
		- deezer
		- spotify
/music/:musicId/stats
	`fetch stats`
		- averageScore
		- favorites
		- popularity
		- scoreDistribution
		- statusDistribution
		- playCount
		- listeners
/music/:musicId/friends
	`Return list of all friends that have this music in list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/music/:musicId/people
	`Return list of all people that have this music in their list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/music/:musicId/recommendations
	`Return all recommendations for this music`
		- Empty for now

/books 
	`Returns 50 book entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
		- genres
		- tags
	cursor pagination on id
/books/filters
	`Returns all available catalog filters for books`
		- statuses
		- formats
		- genres
		- tags
		- years
		- authors
		- publishers
/books/:bookId
	`fetch overview data by id`
		- id
		- 16 characters (main have priority)
		- all 3 titles
		- subtitle
		- cover, bannerImage
		- description
		- originalLanguage
		- countryOfOrigin
		- authors
		- publishers
		- series
		- seriesPosition
		- pageCount
		- chapterCount
		- volumeCount
		- startDateYear/month/day
		- genres
		- subjects
		- tags
		- format
		- status
		- averageScore
		- favorites
		- popularity
		- isAdult
		- synonyms
		- ageRating
		- ageRatingGuide
		- retailPrice
		- retailPriceCurrency
		- updatedAt
		- googleBookId
		- isbn10
		- isbn13
		- openLibraryId
		- externalLinks
/books/:bookId/similar
	`Returns 24 most similar entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
		- genres
		- tags
/books/:bookId/relations
	`fetch relations for book`
		- id
		- sourceType
		- sourceId
		- targetType
		- targetId
		- type
		- data
			- id
			- all 3 titles
			- cover, bannerImage
			- averageScore
			- format
			- status
			- startDateYear
			- description
			- genres
			- tags
/books/:bookId/characters
	`Fetch all characters for book`
		- id
		- mediaId
		- mediaType
		- characterId
		- role
		- characterData
			- id
			- age
			- dateOfBirthDay/month/year
			- description
			- gender
			- image
			- nameNative
			- namePrimary
/books/:bookId/staff
	`fetch all staff for book`
		- id
		- mediaId
		- mediaType
		- personId
		- role
		- customRole
		- personData
			- id
			- namePrimary
			- nameNative
			- nameAlternative
			- image
			- gender
			- language
			- description
/books/:bookId/images
	`fetch all images`
		- googlebooks
		- openlibrary
/books/:bookId/stats
	`fetch stats`
		- averageScore
		- favorites
		- popularity
		- scoreDistribution
		- statusDistribution
		- googleBooksRating
		- googleBooksRatingsCount
/books/:bookId/friends
	`Return list of all friends that have this book in list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- secondaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/books/:bookId/people
	`Return list of all people that have this book in their list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- secondaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/books/:bookId/recommendations
	`Return all recommendations for this book`
		- Empty for now

/other 
	`Returns 50 other entries`
		- id
		- all 3 titles
		- cover, bannerImage
		- averageScore
		- format
		- status
		- startDateYear
		- description
	cursor pagination on id
/other/filters
	`Returns all available catalog filters for other`
		- formats
		- statuses
		- years
/other/:otherId
	`fetch overview data by id`
		- id
		- creatorId
		- creator:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
		- all 3 titles
		- cover, bannerImage
		- description
		- format
		- startDate
		- endDate
		- isPublished
		- progressFields
		- incrementFieldKey
		- averageScore
		- favorites
		- popularity
		- status
		- createdAt
		- updatedAt
/other/:otherId/stats
	`fetch stats`
		- averageScore
		- favorites
		- popularity
		- scoreDistribution
		- statusDistribution
/other/:otherId/friends
	`Return list of all friends that have this other in list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- secondaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/other/:otherId/people
	`Return list of all people that have this other in their list`
		- id
		- userId
		- status
		- score
		- primaryProgress
		- secondaryProgress
		- user:
			- id
			- username
			- displayName
			- avatarUrl
			- avatarFrame
			- displayNameStyle
			- customization
/other/:otherId/recommendations
	`Return all recommendations for this other`
		- Empty for now
