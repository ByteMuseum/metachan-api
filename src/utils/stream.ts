import { animeCacheRepository } from '../repositories/AnimeCacheRepository';
import Logger from './logger';

interface AvailableEpisodes {
  sub: number;
  dub: number;
}

interface ShowEdge {
  _id: string;
  name: string;
  availableEpisodes: AvailableEpisodes;
}

interface ShowSearchResponse {
  data: {
    shows: {
      edges: ShowEdge[];
    };
  };
}

interface AvailableEpisodesDetail {
  sub: string[];
  dub: string[];
}

interface ShowEpisodeDetailResponse {
  data: {
    show: {
      _id: string;
      availableEpisodesDetail: AvailableEpisodesDetail;
    };
  };
}

interface SourceUrl {
  sourceUrl: string;
  sourceName: string;
}

interface EpisodeResponse {
  data: {
    episode: {
      episodeString: string;
      sourceUrls: SourceUrl[];
    };
  };
}

interface StreamLink {
  url: string;
  server: string;
}

export interface StreamLinks {
  sub: StreamLink[];
  dub: StreamLink[];
}

interface EpisodeInfo {
  sub: string[];
  dub: string[];
}

const BASE_URL = 'https://api.allanime.day/api';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0';

function calculateSimilarity(query: string, title: string): number {
  query = query.toLowerCase().trim();
  title = title.toLowerCase().trim();

  if (query === title) return 1.0;
  if (title.includes(query)) return 0.9;

  let matches = 0;
  const queryChars = query.split('');
  const titleChars = title.split('');

  for (const queryChar of queryChars) {
    for (const titleChar of titleChars) {
      if (queryChar === titleChar) {
        matches++;
        break;
      }
    }
  }

  return matches / query.length;
}

function decodeURL(encodedString: string): string {
  if (!encodedString.startsWith('--')) {
    return encodedString;
  }

  const decodeMap: Record<string, string> = {
    '01': '9',
    '08': '0',
    '05': '=',
    '0a': '2',
    '0b': '3',
    '0c': '4',
    '07': '?',
    '00': '8',
    '5c': 'd',
    '0f': '7',
    '5e': 'f',
    '17': '/',
    '54': 'l',
    '09': '1',
    '48': 'p',
    '4f': 'w',
    '0e': '6',
    '5b': 'c',
    '5d': 'e',
    '0d': '5',
    '53': 'k',
    '1e': '&',
    '5a': 'b',
    '59': 'a',
    '4a': 'r',
    '4c': 't',
    '4e': 'v',
    '57': 'o',
    '51': 'i',
  };

  return (
    encodedString
      .slice(2)
      .match(/.{1,2}/g)
      ?.map((pair) => decodeMap[pair] || '')
      .join('') || ''
  );
}

function processProviderURL(urlStr: string): string {
  const baseURL = 'https://allanime.day';

  if (urlStr.startsWith('/')) {
    urlStr = urlStr.replace('/apivtwo/clock', '/apivtwo/clock.json');
    return baseURL + urlStr;
  }

  return urlStr;
}

function getServerName(sourceType: string): string {
  switch (sourceType) {
    case 'default':
      return 'Maria';
    case 'Luf-mp4':
      return 'Rose';
    case 'S-mp4':
      return 'Sina';
    case 'Default':
      return 'Eren';
    case 'Luf-Mp4':
      return 'Mikasa';
    case 'S-Mp4':
      return 'Armin';
    default:
      return sourceType;
  }
}

async function getClockLink(urlStr: string): Promise<string | null> {
  if (urlStr.startsWith('/')) {
    urlStr = 'https://allanime.day' + urlStr;
  }

  const headers = new Headers({
    'User-Agent': USER_AGENT,
    Referer: 'https://allmanga.to',
  });

  try {
    const response = await fetch(urlStr, { headers });

    if (!response.ok) {
      Logger.warn(`Clock link fetch failed with status ${response.status}: ${urlStr}`, {
        timestamp: true,
        prefix: 'Anime Stream',
      });
      return null;
    }
    const text = await response.text();

    try {
      const data = JSON.parse(text);
      if (data.links && data.links.length > 0) {
        return data.links[0].link;
      }

      Logger.warn(`No valid links in clock link response: ${urlStr}`, {
        timestamp: true,
        prefix: 'Anime Stream',
      });
      return null;
    } catch (parseError) {
      Logger.error(
        `Failed to parse clock link response for ${urlStr}: ${text}, error: ${parseError}`,
        { timestamp: true, prefix: 'Anime Stream' },
      );
      return null;
    }
  } catch (error) {
    Logger.error(`Error resolving clock link: ${error}`, {
      timestamp: true,
      prefix: 'Anime Stream',
    });
    return null;
  }
}

function processSourceURL(sourceURL: string, sourceType: string): StreamLink {
  let decodedURL = sourceURL.startsWith('--')
    ? decodeURL(sourceURL)
    : sourceURL.replace(/\\u002F/g, '/');

  const processedURL = processProviderURL(decodedURL);

  return {
    url: processedURL,
    server: getServerName(sourceType),
  };
}

export async function getEpisodes(animeName: string): Promise<EpisodeInfo> {
  try {
    const headers = new Headers({
      'User-Agent': USER_AGENT,
      Referer: 'https://allmanga.to',
    });

    const searchQuery = `
        query(
            $search: SearchInput
            $limit: Int
            $page: Int
            $countryOrigin: VaildCountryOriginEnumType
        ) {
            shows(
                search: $search
                limit: $limit
                page: $page
                countryOrigin: $countryOrigin
            ) {
                edges {
                    _id
                    name
                    availableEpisodes
                    __typename
                }
            }
        }
        `;

    const variables = {
      search: {
        allowAdult: false,
        allowUnknown: false,
        query: animeName,
      },
      limit: 40,
      page: 1,
      countryOrigin: 'ALL',
    };

    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      query: searchQuery,
    });

    const response = await fetch(`${BASE_URL}?${params}`, { headers });
    const data = (await response.json()) as ShowSearchResponse;

    const shows = data.data.shows.edges;

    const sortedShows = shows
      .map((show) => ({
        id: show._id,
        name: show.name,
        subEpisodes: show.availableEpisodes.sub,
        dubEpisodes: show.availableEpisodes.dub,
      }))
      .sort(
        (a, b) => calculateSimilarity(animeName, b.name) - calculateSimilarity(animeName, a.name),
      );

    if (sortedShows.length === 0) {
      Logger.warn(`No anime found for query: ${animeName}`, {
        timestamp: true,
        prefix: 'Anime Stream',
      });
      return { sub: [], dub: [] };
    }

    const bestMatch = sortedShows[0];

    const episodesQuery = `
        query ($showId: String!) {
            show(
                _id: $showId
            ) {
                _id
                availableEpisodesDetail
            }
        }
        `;

    const episodesVariables = {
      showId: bestMatch.id,
    };

    const episodesParams = new URLSearchParams({
      variables: JSON.stringify(episodesVariables),
      query: episodesQuery,
    });

    const episodesResponse = await fetch(`${BASE_URL}?${episodesParams}`, { headers });
    const episodesData = (await episodesResponse.json()) as ShowEpisodeDetailResponse;

    const episodesDetail = episodesData.data.show.availableEpisodesDetail;

    const parseEpisodes = (episodes: string[]): string[] =>
      episodes.map((ep) => ep).sort((a, b) => parseInt(a) - parseInt(b));

    return {
      sub: parseEpisodes(episodesDetail.sub),
      dub: parseEpisodes(episodesDetail.dub),
    };
  } catch (error) {
    Logger.error(`Error fetching episodes for ${animeName}: ${error}`, {
      timestamp: true,
      prefix: 'Anime Stream',
    });
    return { sub: [], dub: [] };
  }
}

export async function getEpisodeStreamingLinks(
  animeName: string,
  episode: number,
  malId?: number,
): Promise<StreamLinks> {
  if (malId) {
    const cached = await animeCacheRepository.getCachedStreamingLinks(malId, episode);
    if (cached) {
      return cached;
    }
  }

  try {
    const headers = new Headers({
      'User-Agent': USER_AGENT,
      Referer: 'https://allmanga.to',
    });

    const searchQuery = `
        query(
            $search: SearchInput
            $limit: Int
            $page: Int
            $countryOrigin: VaildCountryOriginEnumType
        ) {
            shows(
                search: $search
                limit: $limit
                page: $page
                countryOrigin: $countryOrigin
            ) {
                edges {
                    _id
                    name
                    availableEpisodes
                    __typename
                }
            }
        }
        `;

    const variables = {
      search: {
        allowAdult: false,
        allowUnknown: false,
        query: animeName,
      },
      limit: 40,
      page: 1,
      countryOrigin: 'ALL',
    };

    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      query: searchQuery,
    });

    const response = await fetch(`${BASE_URL}?${params}`, { headers });
    const data = (await response.json()) as ShowSearchResponse;

    const shows = data.data.shows.edges;

    const sortedShows = shows
      .map((show) => ({
        id: show._id,
        name: show.name,
        subEpisodes: show.availableEpisodes.sub,
        dubEpisodes: show.availableEpisodes.dub,
      }))
      .sort(
        (a, b) => calculateSimilarity(animeName, b.name) - calculateSimilarity(animeName, a.name),
      );

    if (sortedShows.length === 0) {
      Logger.warn(`No anime found for query: ${animeName}`, {
        timestamp: true,
        prefix: 'Anime Stream',
      });
      return { sub: [], dub: [] };
    }

    const bestMatch = sortedShows[0];

    const streamLinks: StreamLinks = {
      sub: [],
      dub: [],
    };

    const fetchLinks = async (mode: 'sub' | 'dub') => {
      const episodeQuery = `
            query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
                episode(
                    showId: $showId
                    translationType: $translationType
                    episodeString: $episodeString
                ) {
                    episodeString
                    sourceUrls
                }
            }
            `;

      const episodeVariables = {
        showId: bestMatch.id,
        translationType: mode,
        episodeString: episode.toString(),
      };

      const episodeParams = new URLSearchParams({
        variables: JSON.stringify(episodeVariables),
        query: episodeQuery,
      });

      const episodeResponse = await fetch(`${BASE_URL}?${episodeParams}`, { headers });
      const episodeData = (await episodeResponse.json()) as EpisodeResponse;

      const sourceUrls = episodeData.data.episode.sourceUrls;

      const modeLinks: StreamLink[] = [];

      for (const source of sourceUrls) {
        if (!source.sourceUrl) {
          continue;
        }

        let processedLink = processSourceURL(source.sourceUrl, source.sourceName);

        if (processedLink.url.includes('/apivtwo/clock')) {
          const resolvedClockLink = await getClockLink(processedLink.url);
          if (resolvedClockLink) {
            processedLink.url = resolvedClockLink;
          } else {
            continue;
          }
        }

        const validPatterns = ['sharepoint.com', '.m3u8', '.mp4', 'fast4speed.rsvp'];
        const isValidLink = validPatterns.some((pattern) =>
          processedLink.url.toLowerCase().includes(pattern),
        );

        if (isValidLink) {
          modeLinks.push(processedLink);
        }
      }

      return modeLinks;
    };

    if (bestMatch.subEpisodes > 0) {
      streamLinks.sub = await fetchLinks('sub');
    }

    if (bestMatch.dubEpisodes > 0) {
      streamLinks.dub = await fetchLinks('dub');
    }

    Logger.info(
      `Found ${streamLinks.sub.length} sub and ${streamLinks.dub.length} dub links for ${animeName} - Episode ${episode}`,
      { timestamp: true, prefix: 'Anime Stream' },
    );

    if (malId) {
      await animeCacheRepository.cacheStreamingLinks(malId, episode, streamLinks);
      Logger.info(`Cached streaming links for ${animeName} episode ${episode}`, {
        timestamp: true,
        prefix: 'Stream Cache',
      });
    }

    return streamLinks;
  } catch (error) {
    Logger.error(`Error fetching streaming links for ${animeName}: ${error}`, {
      timestamp: true,
      prefix: 'Anime Stream',
    });
    return { sub: [], dub: [] };
  }
}
