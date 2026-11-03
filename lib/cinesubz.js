// lib/cinesubz.js - CineSubz Scraper and Link Resolver
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_PATH = path.join(__dirname, '../store/cinesubz_movies.json');

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,si;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
};

/**
 * Fetch HTML with retries and timeout
 */
export async function fetchHtml(url, referer = 'https://cinesubz.lk/', retries = 3) {
    let lastError = null;
    for (let i = 0; i < retries; i++) {
        try {
            const res = await axios.get(url, {
                headers: {
                    ...DEFAULT_HEADERS,
                    Referer: referer
                },
                timeout: 15000
            });
            return res.data;
        } catch (err) {
            lastError = err;
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            }
        }
    }
    throw lastError || new Error(`Failed to fetch ${url}`);
}

/**
 * Clean Sinhala and Subtitle tags from title
 */
export function cleanTitle(raw) {
    if (!raw) return '';
    return raw
        .replace(/\|\s*සිංහල උපසිරැසි සමඟ.*$/i, '')
        .replace(/Sinhala Subtitles.*$/i, '')
        .replace(/\(\s*\)/g, '')
        .trim();
}

/**
 * Extract Sinhala subtitle tag from title
 */
export function extractSinhala(raw) {
    if (!raw) return '';
    const match = raw.match(/සිංහල උපසිරැසි.*/);
    return match ? match[0].trim() : '';
}

/**
 * Resolves CineSubz redirection JavaScript mappings
 */
export function resolveCineSubzUrl(originalUrl) {
    if (!originalUrl) return null;
    
    const urlMappings = [
        { search: ["https://google.com/server11/1:/", "https://google.com/server12/1:/", "https://google.com/server13/1:/"], replace: "https://drive.csplayer2.space/server1/" },
        { search: ["https://google.com/server21/1:/", "https://google.com/server22/1:/", "https://google.com/server23/1:/"], replace: "https://drive.csplayer2.space/server2/" },
        { search: ["https://google.com/server3/1:/"], replace: "https://drive.csplayer2.space/server3/" },
        { search: ["https://google.com/server4/1:/"], replace: "https://drive.csplayer2.space/server4/" },
        { search: ["https://google.com/server5/1:/"], replace: "https://drive.csplayer2.space/server5/" },
        { search: ["https://google.com/server6/"], replace: "https://drive.csplayer2.space/server6/" },
        { search: ["https://google.com/server7/"], replace: "https://drive.csplayer2.space/server7/" }
    ];

    let modifiedUrl = originalUrl;
    let urlChanged = false;

    for (const mapping of urlMappings) {
        if (urlChanged) break;
        for (const searchUrl of mapping.search) {
            if (urlChanged) break;
            const tempUrl = originalUrl.replace(searchUrl, mapping.replace);
            if (tempUrl !== originalUrl) {
                modifiedUrl = tempUrl;
                if (modifiedUrl.includes(".mp4?bot=cscloud2bot&code=")) {
                    modifiedUrl = modifiedUrl.replace(".mp4?bot=cscloud2bot&code=", "?ext=mp4&bot=cscloud2bot&code=");
                } else if (modifiedUrl.includes(".mp4")) {
                    modifiedUrl = modifiedUrl.replace(".mp4", "?ext=mp4");
                } else if (modifiedUrl.includes(".mkv?bot=cscloud2bot&code=")) {
                    modifiedUrl = modifiedUrl.replace(".mkv?bot=cscloud2bot&code=", "?ext=mkv&bot=cscloud2bot&code=");
                } else if (modifiedUrl.includes(".mkv")) {
                    modifiedUrl = modifiedUrl.replace(".mkv", "?ext=mkv");
                } else if (modifiedUrl.includes(".zip")) {
                    modifiedUrl = modifiedUrl.replace(".zip", "?ext=zip");
                }
                urlChanged = true;
            }
        }
    }

    if (!urlChanged) {
        let tempUrl = originalUrl;
        let t1 = tempUrl.replace("srilank222", "srilanka2222");
        if (t1 !== tempUrl) tempUrl = t1;
        let t2 = tempUrl.replace("https://tsadsdaas.me/", "http://tdsdfasdaddd.me/");
        if (t2 !== tempUrl) tempUrl = t2;
        modifiedUrl = tempUrl;
    }

    return modifiedUrl;
}

/**
 * Resolves a zt-links protector URL to the actual download link
 */
export async function resolveDirectDownload(ztUrl, referer = 'https://cinesubz.lk/') {
    try {
        const html = await fetchHtml(ztUrl, referer);
        const $ = cheerio.load(html);
        const rawLink = $('#link').attr('href') || $('a#link').attr('href') || '';
        
        if (!rawLink) {
            return {
                success: false,
                error: 'Direct link element not found on page'
            };
        }

        const resolvedUrl = resolveCineSubzUrl(rawLink);

        // Attempt csplayer2 direct stream API if applicable
        let finalRedirect = null;
        if (resolvedUrl && resolvedUrl.includes('drive.csplayer2.space')) {
            try {
                const parsed = new URL(resolvedUrl);
                const apiPath = `/api/download-data${parsed.pathname}${parsed.search}`;
                const apiFull = `https://${parsed.host}${apiPath}`;
                
                const apiRes = await axios.get(apiFull, {
                    headers: {
                        ...DEFAULT_HEADERS,
                        Referer: resolvedUrl,
                        Accept: 'application/json'
                    },
                    timeout: 8000
                });

                if (apiRes.data && apiRes.data.redirect) {
                    finalRedirect = apiRes.data.redirect.startsWith('http')
                        ? apiRes.data.redirect
                        : `https://${parsed.host}${apiRes.data.redirect}`;
                }
            } catch (apiErr) {
                // Ignore API failure, fallback to resolvedUrl
            }
        }

        return {
            success: true,
            rawLink,
            resolvedUrl: resolvedUrl || rawLink,
            finalDownloadLink: finalRedirect || resolvedUrl || rawLink
        };
    } catch (e) {
        return {
            success: false,
            error: e.message
        };
    }
}

/**
 * Scrape a single movies archive page (e.g. Page 1, 2, ... 227)
 */
export async function getMoviesPage(pageNumber = 1) {
    const url = pageNumber <= 1 
        ? 'https://cinesubz.lk/movies/' 
        : `https://cinesubz.lk/movies/page/${pageNumber}/`;
    
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Extract total pages
    const totalText = $('.pagination .total').text();
    const totalMatch = totalText.match(/Page \d+ of (\d+)/i);
    const totalPages = totalMatch ? parseInt(totalMatch[1]) : 227;

    const movies = [];
    $('.display-item').each((i, el) => {
        const a = $(el).find('.item-box a');
        const href = a.attr('href');
        const fullTitle = a.attr('title') || $(el).find('.item-desc-title h3').text().trim();
        const img = $(el).find('img').attr('data-original') 
            || $(el).find('img').attr('src')
            || '';
        const rating = $(el).find('.imdb-score').text().trim() || 'N/A';
        const quality = $(el).find('.badge-quality-corner').text().trim() || 'WEB-DL';

        if (href && fullTitle) {
            movies.push({
                title: cleanTitle(fullTitle),
                fullTitle,
                sinhala: extractSinhala(fullTitle),
                url: href,
                image: img,
                rating,
                quality,
                page: pageNumber
            });
        }
    });

    return {
        page: pageNumber,
        totalPages,
        count: movies.length,
        movies
    };
}

/**
 * Search movies by query on CineSubz
 */
export async function searchMovies(query, page = 1) {
    const url = page <= 1
        ? `https://cinesubz.lk/?s=${encodeURIComponent(query)}`
        : `https://cinesubz.lk/page/${page}/?s=${encodeURIComponent(query)}`;

    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Extract total pages
    const totalText = $('.pagination .total').text();
    const totalMatch = totalText.match(/Page \d+ of (\d+)/i);
    const totalPages = totalMatch ? parseInt(totalMatch[1]) : 1;

    const movies = [];
    $('.display-item, .result-item').each((i, el) => {
        const a = $(el).find('a').first();
        const href = a.attr('href');
        const fullTitle = a.attr('title') || $(el).find('.item-desc-title, .title, h3').text().trim();
        const img = $(el).find('img').attr('data-original') 
            || $(el).find('img').attr('src')
            || '';
        const rating = $(el).find('.imdb-score').text().trim() || 'N/A';
        const quality = $(el).find('.badge-quality-corner').text().trim() || 'HD';

        // Filter for movies if possible (or include all matching)
        if (href && fullTitle && !href.includes('/director/') && !href.includes('/actor/')) {
            movies.push({
                title: cleanTitle(fullTitle),
                fullTitle,
                sinhala: extractSinhala(fullTitle),
                url: href,
                image: img,
                rating,
                quality,
                isTvShow: href.includes('/tvshows/')
            });
        }
    });

    return {
        query,
        page,
        totalPages,
        count: movies.length,
        movies
    };
}

/**
 * Get detailed movie information and all download links
 */
export async function getMovieDetails(movieUrl) {
    const html = await fetchHtml(movieUrl);
    const $ = cheerio.load(html);

    const fullTitle = $('.details-title h3, .entry-title').first().text().trim() 
        || $('meta[property="og:title"]').attr('content') 
        || '';
    const title = cleanTitle(fullTitle);
    const sinhala = extractSinhala(fullTitle);

    const image = $('.content-poster img, .poster img').first().attr('src')
        || $('.content-poster img, .poster img').first().attr('data-original')
        || $('meta[property="og:image"]').attr('content')
        || '';

    const dateCreated = $('meta[itemprop="dateCreated"]').attr('content') || '';
    const imdbRating = $('.imdb-score, .zt_rating_vgs').first().text().trim() || 'N/A';

    const detailsData = [];
    $('.details-data span').each((i, el) => {
        const t = $(el).text().trim();
        if (t && !t.includes('views') && !t.includes('(')) detailsData.push(t);
    });

    const genres = [];
    $('.details-genre a').each((i, el) => {
        const g = $(el).text().trim();
        if (g && !g.startsWith('#') && !genres.includes(g)) genres.push(g);
    });

    const cast = [];
    $('.zt-cast-info a, .cast-item a').each((i, el) => {
        const c = $(el).text().trim();
        if (c && !c.includes('Cast') && !c.includes('Go Full') && !cast.includes(c)) cast.push(c);
    });

    const synopsis = $('.details-desc').text().trim().replace(/\s+/g, ' ');

    const downloads = [];
    $('.movie-download-link-item').each((i, el) => {
        const btn = $(el).find('a.movie-download-button');
        const href = btn.attr('href');
        const type = $(el).find('.movie-download-type').text().trim();
        const meta = $(el).find('.movie-download-meta').text().trim();
        
        const qMatch = meta.match(/(480p|720p|1080p|2160p|4k|HD|CAM|DVD)/i);
        const sMatch = meta.match(/(\d+(?:\.\d+)?\s*(?:MB|GB))/i);

        if (href) {
            downloads.push({
                index: downloads.length + 1,
                quality: qMatch ? qMatch[1].toUpperCase() : 'DIRECT',
                size: sMatch ? sMatch[1].toUpperCase() : 'N/A',
                meta: meta || 'Download',
                type: type || 'Direct Download',
                link: href
            });
        }
    });

    return {
        title,
        fullTitle,
        sinhala,
        image,
        dateCreated,
        imdbRating,
        detailsData,
        genres,
        cast: cast.slice(0, 5),
        synopsis,
        downloads,
        url: movieUrl
    };
}

/**
 * Load locally cached/scraped movies from disk
 */
export function loadScrapedMovies() {
    try {
        if (fs.existsSync(STORE_PATH)) {
            const raw = fs.readFileSync(STORE_PATH, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('Failed to load scraped movies:', e.message);
    }
    return { lastUpdated: null, totalPages: 0, movies: [] };
}

/**
 * Save scraped movies to disk
 */
export function saveScrapedMovies(data) {
    try {
        const dir = path.dirname(STORE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('Failed to save scraped movies:', e.message);
        return false;
    }
}

/**
 * Fast search against locally scraped movies
 */
export function searchLocalMovies(query, limit = 15) {
    const db = loadScrapedMovies();
    if (!db.movies || db.movies.length === 0) return [];
    
    const terms = query.toLowerCase().trim().split(/\s+/);
    return db.movies.filter(m => {
        const full = (m.title + ' ' + (m.fullTitle || '') + ' ' + (m.sinhala || '')).toLowerCase();
        return terms.every(t => full.includes(t));
    }).slice(0, limit);
}

export default {
    fetchHtml,
    cleanTitle,
    extractSinhala,
    resolveCineSubzUrl,
    resolveDirectDownload,
    getMoviesPage,
    searchMovies,
    getMovieDetails,
    loadScrapedMovies,
    saveScrapedMovies,
    searchLocalMovies
};

