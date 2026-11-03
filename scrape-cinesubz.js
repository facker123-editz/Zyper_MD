#!/usr/bin/env node
// scrape-cinesubz.js - Comprehensive CineSubz Scraper Tool
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cinesubz, { 
    getMoviesPage, 
    getMovieDetails, 
    loadScrapedMovies, 
    saveScrapedMovies 
} from './lib/cinesubz.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to delay between requests
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('   🎬 CINESUBZ.LK MOVIE ARCHIVE SCRAPER 🎬');
    console.log('══════════════════════════════════════════════════');

    const args = process.argv.slice(2);
    let startPage = 1;
    let endPage = null;
    let isDeep = args.includes('--deep');
    let isResume = args.includes('--resume');

    // Parse --pages X-Y
    const pagesIndex = args.findIndex(a => a === '--pages' || a === '-p');
    if (pagesIndex !== -1 && args[pagesIndex + 1]) {
        const parts = args[pagesIndex + 1].split('-');
        startPage = parseInt(parts[0]) || 1;
        if (parts[1]) endPage = parseInt(parts[1]);
    }

    // Load existing data
    const existingData = loadScrapedMovies();
    let moviesMap = new Map();
    if (existingData.movies && Array.isArray(existingData.movies)) {
        for (const m of existingData.movies) {
            moviesMap.set(m.url, m);
        }
        console.log(`📦 Loaded ${moviesMap.size} existing movies from store/cinesubz_movies.json`);
    }

    // Fetch page 1 to determine total pages if not set
    console.log('📡 Fetching CineSubz archive info...');
    const firstPage = await getMoviesPage(1);
    const totalPages = endPage || firstPage.totalPages || 227;
    console.log(`📑 Total Pages Available: ${firstPage.totalPages}`);
    console.log(`🎯 Scraping Range: Page ${startPage} to Page ${totalPages}`);
    console.log(`🔍 Mode: ${isDeep ? 'Deep (Scraping full details & downloads)' : 'Fast (Index + Cover Images + Details)'}`);
    console.log('──────────────────────────────────────────────────');

    const startTime = Date.now();
    let totalScraped = 0;

    for (let p = startPage; p <= totalPages; p++) {
        try {
            const pageData = p === 1 ? firstPage : await getMoviesPage(p);
            let pageNewCount = 0;

            for (const item of pageData.movies) {
                if (isDeep) {
                    // Deep scrape details & downloads
                    try {
                        console.log(`   ⏳ Fetching details: ${item.title}...`);
                        const details = await getMovieDetails(item.url);
                        moviesMap.set(item.url, { ...item, ...details });
                        await sleep(300); // respect server
                    } catch (dErr) {
                        moviesMap.set(item.url, item);
                    }
                } else {
                    if (!moviesMap.has(item.url)) {
                        moviesMap.set(item.url, item);
                        pageNewCount++;
                    } else {
                        // Update with fresh data if needed
                        moviesMap.set(item.url, { ...moviesMap.get(item.url), ...item });
                    }
                }
                totalScraped++;
            }

            const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`✅ [Page ${p}/${totalPages}] Done (${pageData.movies.length} movies) | Total Stored: ${moviesMap.size} | Elapsed: ${elapsedSec}s`);

            // Auto-save every 5 pages or at the end
            if (p % 5 === 0 || p === totalPages) {
                saveScrapedMovies({
                    lastUpdated: new Date().toISOString(),
                    totalPages: firstPage.totalPages,
                    totalMovies: moviesMap.size,
                    movies: Array.from(moviesMap.values())
                });
                console.log(`💾 Progress auto-saved to store/cinesubz_movies.json`);
            }

            // Small delay between archive pages to avoid rate limits
            await sleep(400);

        } catch (err) {
            console.error(`❌ Error scraping page ${p}:`, err.message);
            // Brief pause and continue to next page
            await sleep(1500);
        }
    }

    const finalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('══════════════════════════════════════════════════');
    console.log(`🎉 SCRAPING COMPLETE!`);
    console.log(`📊 Total Movies in Store: ${moviesMap.size}`);
    console.log(`⏱️ Time Taken: ${finalTime}s`);
    console.log(`📁 Saved to: store/cinesubz_movies.json`);
    console.log('══════════════════════════════════════════════════');
}

main().catch(err => {
    console.error('Fatal Scraper Error:', err);
    process.exit(1);
});

