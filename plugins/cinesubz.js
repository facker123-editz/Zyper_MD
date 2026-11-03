// plugins/cinesubz.js - CineSubz.lk Movies Downloader & Scraper Plugin
import { fileURLToPath } from 'url';
import path from 'path';
import { cmd } from '../command.js';
import config from '../config.js';
import cinesubz, {
    getMoviesPage,
    searchMovies,
    getMovieDetails,
    resolveDirectDownload,
    searchLocalMovies,
    saveScrapedMovies,
    loadScrapedMovies
} from '../lib/cinesubz.js';

const __filename = fileURLToPath(import.meta.url);

const commonContextInfo = (sender) => ({
    mentionedJid: sender ? [sender] : [],
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: config.NEWSLETTERID || '120363426563532140@newsletter',
        newsletterName: config.BOT_NAME || 'Zypher MD',
        serverMessageId: 143
    }
});

/**
 * Handle sending movie card and setting up download selection listener
 */
async function sendMovieCardAndListen(conn, mek, from, sender, movieUrl) {
    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

    try {
        const details = await getMovieDetails(movieUrl);

        if (!details || !details.title) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return conn.sendMessage(from, { text: '❌ Failed to retrieve movie details. Please try again later.' }, { quoted: mek });
        }

        // Build downloads text
        let dlText = '';
        if (details.downloads && details.downloads.length > 0) {
            dlText = details.downloads.map(d => {
                return `*${d.index}.* 📦 *${d.quality}* (${d.size})\n   ↳ _${d.meta}_`;
            }).join('\n');
        } else {
            dlText = '_No direct download links found for this title._';
        }

        // Build synopsis snippet (limit to ~400 chars for readability)
        let synopsisDisplay = details.synopsis || 'No synopsis available.';
        if (synopsisDisplay.length > 450) {
            synopsisDisplay = synopsisDisplay.substring(0, 450) + '...';
        }

        const caption = `🎬 *${details.title}*
${details.sinhala ? `🇱🇰 _${details.sinhala}_\n` : ''}
*⭐ Rating:* ${details.imdbRating}
*📅 Released:* ${details.dateCreated || 'N/A'}
*⏱️ Duration:* ${details.detailsData?.join(' • ') || 'N/A'}
*🎭 Genres:* ${details.genres?.join(', ') || 'N/A'}
${details.cast && details.cast.length > 0 ? `*👥 Cast:* ${details.cast.join(', ')}\n` : ''}
*📝 Synopsis:*
${synopsisDisplay}

───────────────────────
*📥 AVAILABLE DOWNLOAD QUALITIES:*
${dlText}
───────────────────────

> 💬 *Reply with the number (1-${details.downloads.length}) to get the direct download link!*
> _Powered by ${config.BOT_NAME}_`;

        let mediaPayload = { text: caption };
        if (details.image && (details.image.startsWith('http://') || details.image.startsWith('https://'))) {
            mediaPayload = {
                image: { url: details.image },
                caption: caption,
                contextInfo: commonContextInfo(sender)
            };
        } else {
            mediaPayload = {
                text: caption,
                contextInfo: commonContextInfo(sender)
            };
        }

        const cardMsg = await conn.sendMessage(from, mediaPayload, { quoted: mek });
        await conn.sendMessage(from, { react: { text: '🎬', key: mek.key } });

        if (!details.downloads || details.downloads.length === 0) return;

        const cardMsgId = cardMsg.key.id;

        // Download option listener
        const downloadListener = async (msgData) => {
            try {
                const receivedMsg = msgData.messages[0];
                if (!receivedMsg.message) return;

                const receivedText = receivedMsg.message.conversation || receivedMsg.message.extendedTextMessage?.text;
                const senderID = receivedMsg.key.remoteJid;
                const isReplyToCard = receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === cardMsgId;

                if (isReplyToCard && receivedText) {
                    const selectedIdx = parseInt(receivedText.trim());
                    if (!isNaN(selectedIdx) && selectedIdx >= 1 && selectedIdx <= details.downloads.length) {
                        conn.ev.off("messages.upsert", downloadListener);

                        await conn.sendMessage(senderID, { react: { text: '⏳', key: receivedMsg.key } });
                        const selectedDl = details.downloads[selectedIdx - 1];

                        // Resolve direct download link
                        const resolved = await resolveDirectDownload(selectedDl.link, details.url);

                        let replyMsg = `*🎬 ${details.title}*\n`;
                        replyMsg += `*📦 Quality:* ${selectedDl.quality}\n`;
                        replyMsg += `*📊 File Size:* ${selectedDl.size}\n`;
                        replyMsg += `*🏷️ Info:* ${selectedDl.meta}\n\n`;

                        if (resolved.success && resolved.finalDownloadLink) {
                            replyMsg += `*🚀 Direct Download Link:*\n${resolved.finalDownloadLink}\n\n`;
                        } else if (resolved.resolvedUrl) {
                            replyMsg += `*🚀 Direct Download Link:*\n${resolved.resolvedUrl}\n\n`;
                        }

                        replyMsg += `*🔗 Original Download Page:*\n${selectedDl.link}\n\n`;
                        replyMsg += `> 💡 *Tip:* Open the direct download link in your browser or 1DM / IDM for maximum download speed!\n`;
                        replyMsg += `> _Powered by ${config.BOT_NAME}_`;

                        await conn.sendMessage(senderID, {
                            text: replyMsg,
                            contextInfo: commonContextInfo(receivedMsg.key.participant || senderID)
                        }, { quoted: receivedMsg });

                        await conn.sendMessage(senderID, { react: { text: '✅', key: receivedMsg.key } });
                    }
                }
            } catch (err) {
                console.error("CineSubz Download Listener Error:", err);
            }
        };

        conn.ev.on("messages.upsert", downloadListener);
        setTimeout(() => {
            conn.ev.off("messages.upsert", downloadListener);
        }, 90000); // 90 seconds timeout

    } catch (e) {
        console.error("Error sending movie card:", e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        conn.sendMessage(from, { text: `❌ Error loading movie details: ${e.message}` }, { quoted: mek });
    }
}

// ============================================================================
// COMMAND 1: .cinesubz <search query>
// ============================================================================
cmd({
    pattern: "cinesubz",
    alias: ["cs", "movie", "film", "sinhalasub", "cinesub"],
    desc: "Search & download movies from CineSubz.lk with cover & direct links",
    category: "download",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, sender, reply }) => {
    try {
        if (!q || q.trim() === '') {
            return reply(`🎬 *CineSubz Movie Search* 🎬\n\nSearch and download movies with Sinhala subtitles!\n\n*Usage:* .cinesubz <movie name>\n*Examples:*\n.cinesubz Apocalypse Z\n.cinesubz Avatar\n.cinesubz Leo`);
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        // First check local database
        let results = searchLocalMovies(q, 10);

        // Also search live from CineSubz for newest titles
        try {
            const liveSearch = await searchMovies(q);
            if (liveSearch.movies && liveSearch.movies.length > 0) {
                // Merge unique by URL
                const existingUrls = new Set(results.map(r => r.url));
                for (const lm of liveSearch.movies) {
                    if (!existingUrls.has(lm.url)) {
                        results.push(lm);
                        existingUrls.add(lm.url);
                    }
                }
            }
        } catch (searchErr) {
            console.log("Live search fallback error:", searchErr.message);
        }

        if (!results || results.length === 0) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply(`❌ No movies found matching "${q}". Please check the spelling and try again.`);
        }

        // Limit results to top 10
        const displayResults = results.slice(0, 10);

        // If only 1 result found, open directly!
        if (displayResults.length === 1) {
            return sendMovieCardAndListen(conn, mek, from, sender, displayResults[0].url);
        }

        // Build selection list
        let listText = `🎬 *CINESUBZ MOVIE SEARCH RESULTS* 🎬\n\n`;
        listText += `*Query:* _${q}_\n`;
        listText += `*Found:* ${displayResults.length} movies\n`;
        listText += `───────────────────────\n`;

        displayResults.forEach((m, idx) => {
            listText += `*${idx + 1}.* 📽️ *${m.title}*\n`;
            if (m.rating && m.rating !== 'N/A') listText += `   ⭐ IMDb: ${m.rating} | 🏷️ ${m.quality || 'HD'}\n`;
            listText += `   🔗 _${m.url}_\n\n`;
        });

        listText += `───────────────────────\n`;
        listText += `> 💬 *Reply with the number (1-${displayResults.length}) to view details & downloads!*`;

        const sentMsg = await conn.sendMessage(from, {
            text: listText,
            contextInfo: commonContextInfo(sender)
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '📑', key: mek.key } });

        const searchMsgId = sentMsg.key.id;

        // Interactive listener for movie selection
        const searchListener = async (msgData) => {
            try {
                const receivedMsg = msgData.messages[0];
                if (!receivedMsg.message) return;

                const receivedText = receivedMsg.message.conversation || receivedMsg.message.extendedTextMessage?.text;
                const senderID = receivedMsg.key.remoteJid;
                const isReplyToSearch = receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === searchMsgId;

                if (isReplyToSearch && receivedText) {
                    const selectedIdx = parseInt(receivedText.trim());
                    if (!isNaN(selectedIdx) && selectedIdx >= 1 && selectedIdx <= displayResults.length) {
                        conn.ev.off("messages.upsert", searchListener);
                        const selectedMovie = displayResults[selectedIdx - 1];
                        await sendMovieCardAndListen(conn, receivedMsg, senderID, receivedMsg.key.participant || senderID, selectedMovie.url);
                    }
                }
            } catch (err) {
                console.error("Search listener error:", err);
            }
        };

        conn.ev.on("messages.upsert", searchListener);
        setTimeout(() => {
            conn.ev.off("messages.upsert", searchListener);
        }, 60000); // 60 seconds timeout

    } catch (e) {
        console.error("CineSubz Command Error:", e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ Error: ${e.message}`);
    }
});

// ============================================================================
// COMMAND 2: .cslatest [page]
// ============================================================================
cmd({
    pattern: "cslatest",
    alias: ["latestmovies", "csmovies", "cinesubzlatest"],
    desc: "Browse latest movies on CineSubz.lk page by page",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, sender, reply }) => {
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        let pageNumber = 1;
        if (q && !isNaN(parseInt(q.trim()))) {
            pageNumber = Math.max(1, parseInt(q.trim()));
        }

        const pageData = await getMoviesPage(pageNumber);

        if (!pageData.movies || pageData.movies.length === 0) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply(`❌ No movies found on page ${pageNumber}. Total available pages: ${pageData.totalPages}`);
        }

        // Show top 12 items for clean display
        const displayList = pageData.movies.slice(0, 12);

        let listText = `🎬 *CINESUBZ LATEST MOVIES* 🎬\n`;
        listText += `📄 *Page:* ${pageData.page} / ${pageData.totalPages}\n`;
        listText += `───────────────────────\n`;

        displayList.forEach((m, idx) => {
            listText += `*${idx + 1}.* 📽️ *${m.title}*\n`;
            listText += `   ⭐ IMDb: ${m.rating} | 🏷️ ${m.quality}\n\n`;
        });

        listText += `───────────────────────\n`;
        listText += `> 💬 *Reply with the number (1-${displayList.length}) to get movie details & links!*\n`;
        listText += `> 💡 *Next page:* .cslatest ${pageNumber + 1}`;

        const sentMsg = await conn.sendMessage(from, {
            text: listText,
            contextInfo: commonContextInfo(sender)
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '📑', key: mek.key } });

        const latestMsgId = sentMsg.key.id;

        const latestListener = async (msgData) => {
            try {
                const receivedMsg = msgData.messages[0];
                if (!receivedMsg.message) return;

                const receivedText = receivedMsg.message.conversation || receivedMsg.message.extendedTextMessage?.text;
                const senderID = receivedMsg.key.remoteJid;
                const isReply = receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === latestMsgId;

                if (isReply && receivedText) {
                    const selectedIdx = parseInt(receivedText.trim());
                    if (!isNaN(selectedIdx) && selectedIdx >= 1 && selectedIdx <= displayList.length) {
                        conn.ev.off("messages.upsert", latestListener);
                        const selectedMovie = displayList[selectedIdx - 1];
                        await sendMovieCardAndListen(conn, receivedMsg, senderID, receivedMsg.key.participant || senderID, selectedMovie.url);
                    }
                }
            } catch (err) {
                console.error("Latest listener error:", err);
            }
        };

        conn.ev.on("messages.upsert", latestListener);
        setTimeout(() => {
            conn.ev.off("messages.upsert", latestListener);
        }, 60000);

    } catch (e) {
        console.error("CS Latest Error:", e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ Error loading latest movies: ${e.message}`);
    }
});

// ============================================================================
// COMMAND 3: .cinescrape [pages] (Scrape CineSubz archive into bot local store)
// ============================================================================
cmd({
    pattern: "cinescrape",
    alias: ["csscrape", "scrapemovies"],
    desc: "Scrape pages from CineSubz.lk into bot database",
    category: "owner",
    react: "🔄",
    filename: __filename
}, async (conn, mek, m, { from, q, isOwner, reply }) => {
    try {
        if (!isOwner) {
            return reply("❌ This command is only available to the Bot Owner.");
        }

        let numPages = 5; // default 5 pages
        if (q && !isNaN(parseInt(q.trim()))) {
            numPages = Math.min(227, Math.max(1, parseInt(q.trim())));
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        reply(`🔄 *Starting CineSubz Scraper...*\n\nTarget: First ${numPages} pages (~${numPages * 30} movies)\nThis will run in the background and update the local database.`);

        // Run scraping
        const existingData = loadScrapedMovies();
        const movieMap = new Map();
        if (existingData.movies) {
            for (const item of existingData.movies) {
                movieMap.set(item.url, item);
            }
        }

        let scrapedCount = 0;
        let newCount = 0;

        for (let p = 1; p <= numPages; p++) {
            try {
                const pageData = await getMoviesPage(p);
                for (const m of pageData.movies) {
                    if (!movieMap.has(m.url)) newCount++;
                    movieMap.set(m.url, m);
                    scrapedCount++;
                }
            } catch (pErr) {
                console.error(`Error scraping page ${p}:`, pErr.message);
            }
        }

        saveScrapedMovies({
            lastUpdated: new Date().toISOString(),
            totalPages: 227,
            totalMovies: movieMap.size,
            movies: Array.from(movieMap.values())
        });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        return reply(`✅ *CineSubz Scraping Completed!*\n\n*Pages Scraped:* 1 - ${numPages}\n*New Movies Added:* ${newCount}\n*Total Movies in Database:* ${movieMap.size}\n\nAll movies are now available for offline & instant search with .cinesubz!`);

    } catch (e) {
        console.error("CineScrape Error:", e);
        reply(`❌ Scraping failed: ${e.message}`);
    }
});

