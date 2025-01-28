// ==UserScript==
// @name         SemenDaemon
// @namespace    cuckIndustries
// @version      v1.2
// @description  Video search tool for iwara.tv
// @author       Cuckdev
// @match        https://www.iwara.tv/*
// @grant        GM.info
// @icon         https://www.google.com/s2/favicons?sz=64&domain=iwara.tv
// @downloadURL  https://raw.githubusercontent.com/Cuckdev/SemenDaemon/refs/heads/main/semenDaemon.user.js
// @updateURL    https://raw.githubusercontent.com/Cuckdev/SemenDaemon/refs/heads/main/semenDaemon.user.js

// ==/UserScript==

// For DEV loader script method, since GM object is not available in the injected script
if(!GM)
{
    var GM = {'info': {'script': {'version': 1.2}}}
}

(function() {
    'use strict';
    var videosList = []    
    const MaxSearchResults = 1000;
    const apiAccessToken = localStorage.getItem("token")
    const semenDaemonContainerElement = document.createElement('div');
    semenDaemonContainerElement.id = "semenDaemonContainer";    

    /**
     * Convert seconds to formatted timestamp
     * @param {int} seconds Seconds to convert
     * @returns Timestamp such as 2:25 if the seconds supplied were 145
     */
    function SecondsToTimestamp(seconds) 
    {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
    
        if (hours > 0) 
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * Format a number
     * @param {int} number Number to format
     * @returns Formated number such as 50 -> 50, 2500 -> 2.5k, 6100000 -> 6.1M
     */
    function FormatNumber(number) 
    {
        if (number >= 1_000_000_000) 
            return `${(number / 1_000_000_000).toFixed(2)}B`;        
        else if (number >= 1_000_000) 
            return `${(number / 1_000_000).toFixed(2)}M`;
        else if (number >= 1_000) 
            return `${(number / 1_000).toFixed(2)}K`;
        
        return number.toString();
    }    

    var ThumbCycleElement = null;
    var ThumbCycleData = null;
    var ThumbCycleIndex = 0;

    setInterval(() => { // Thumbnail cycler, for the old type of slideshow video previews
            if(!ThumbCycleElement || !ThumbCycleData)
                return;        

            ThumbCycleIndex = ThumbCycleIndex++ % 10 + 1;
            let videoThumbnailUrl = `https://i.iwara.tv/image/thumbnail/${ThumbCycleData.fileId}/thumbnail-${ThumbCycleIndex.toString().padStart(2, '0')}.jpg`
            ThumbCycleElement.src = videoThumbnailUrl;
        
        }, 1000)


    var VideoElementToScrub = null;
    var ScrubVideoDuration = 120;
    var LastScrubPositon = 0;

    setInterval(() => { // Video scrubber
        if(!VideoElementToScrub)
            return;

        let scrubPos = GetScrubVideoPosition(VideoElementToScrub);

        if(Math.abs(LastScrubPositon - scrubPos) < 5) // Only scrub if mouse moved since last time
            return;

        VideoElementToScrub.play();
        VideoElementToScrub.currentTime = Math.round(ScrubVideoDuration * (scrubPos / 100))
        LastScrubPositon = scrubPos;

    }, 1000)

    /**
     * Generate HTML tile representing the given video data object, to be displayed in the search results
     * @param {object} videoData 
     * @returns 
     */
    function HtmlTileFromVideoData(videoData)
    {           
        try 
        {
            let localizedUploadDateString = videoData.created?.toLocaleString();    
            // First we use the custom thumbnail if it exists, if not then the classic thmbnail picked from the set by thumbnailindex, and if it's an embeded video then we use special link for that
            
            let videoThumbnailUrl = videoData.customThumbnailLink ? `https://i.iwara.tv/image/thumbnail/${videoData.customThumbnailLink.split('.')[0]}/${videoData.customThumbnailLink}` : 
                (videoData.fileId ? `https://i.iwara.tv/image/thumbnail/${videoData.fileId}/thumbnail-${videoData.thumbnailIndex?.toString().padStart(2, '0') ?? '01'}.jpg` : "https://i.iwara.tv/image/embed/thumbnail/youtube/" + videoData.embedUrl?.match(/(?:v=|\/)([a-z0-9_-]+)$/i)?.[1])
            
            let videoThumbnailAnimatedUrl = `https://i.iwara.tv/image/original/${videoData.fileId}/preview.webp`;
            let defaultAvatarUrl = "https://www.iwara.tv/images/default-avatar.jpg";
            let avatarUrl = videoData.uploaderAvatarId ? `https://i.iwara.tv/image/avatar/${videoData.uploaderAvatarId}/${videoData.uploaderAvatarName}` : defaultAvatarUrl;        
            const thumbnailPlaceholder = "data:image/jpeg;base64,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"

            let videoTileElement = document.createElement("div");
            videoTileElement.classList = "videoTile";
            videoTileElement.setAttribute('data-videoid', videoData.videoId);
            videoTileElement.setAttribute('data-orenoid', videoData.orenoId);


            if(videoData.fileId) // Switch to animated thumbnail on mouse hover, (embeded vids don't have animated thumbnail versions)
            {
                videoTileElement.addEventListener('mouseover', (e) => 
                    {
                        let imageElement = videoTileElement.querySelector(".thumbnail img");                        
                        imageElement.src = videoThumbnailAnimatedUrl;                                            
                    });

                videoTileElement.addEventListener('mouseleave', (e) => // Mouseout fires when any child element is left, mouseleave only fires when the element it's attached to is left
                    {
                        VideoElementToScrub = null;
                        ThumbCycleElement = null;
                        ThumbCycleData = null;


                        var imgElement = videoTileElement.querySelector(".thumbnail img");
                        imgElement.style.display = "inline";
                        imgElement.src = videoThumbnailUrl;

                        let videoElement = videoTileElement.querySelector(".thumbnail video");

                        if(videoElement)
                            videoElement.parentNode.removeChild(videoElement);                        
                    });
            }

            videoTileElement.innerHTML = 
            /* html */`            
                    <div class="thumbnail"><img src="${videoThumbnailUrl}" loading="lazy"></div>                        
                    <div class="title">${videoData.title}</div>                
                    <div class="pfp"><img src="${avatarUrl}" loading="lazy"></div> 
                                    <div class="uploader" title="${videoData.uploader}" style="cursor: pointer">${videoData.uploaderDisplayName}</div>
                                    <div class="uploaded">${localizedUploadDateString.replace(/, ([0-9]{1,2}:[0-9]{1,2}):[0-9]{1,2}/i, '')} <span style="float:right; font-weight: bold">${SecondsToTimestamp(videoData.duration)}</span></div>
                                    <div class="metrics">❤️${FormatNumber(videoData.likes)}&nbsp;&nbsp;&nbsp;👁️${FormatNumber(videoData.views)}</div>        
            `;        
            
            videoTileElement.querySelector(".uploader").addEventListener('click', e => window.open('https://www.iwara.tv/profile/' + videoData.uploader));

            // Support for old video previews
            // Older videos don't have animated preview.webp, but instead scrub through pregenerated thumbnail list. If preview.webp fails to load, it means the video likely uses the old preview type, so we mark this video for the thumbnail cycler function which will simulate the video preview
            videoTileElement.querySelector(".thumbnail img").addEventListener('error', (e) => 
            {                
                ThumbCycleElement = e.target;
                ThumbCycleData = videoData;
                e.target.src = thumbnailPlaceholder;

                /*e.target.addEventListener("mouseleave", (e) => { // When mouse moves away from thumbnail restore the previous thumbnail
                    ThumbCycleElement = null;
                    ThumbCycleData = null;
                    e.target.src = videoThumbnailUrl; 
                })     */       
            });

            videoTileElement.querySelector(".pfp img").addEventListener('error', (e) => e.target.src = defaultAvatarUrl)        
            videoTileElement.querySelector(".thumbnail").addEventListener('click', (e) => // On alt + click open oreno page for the video, otherwise iwara page
                {            
                    if (e.altKey)
                    {
                        if(videoTileElement.dataset.orenoid > 0)
                            window.open("https://oreno3d.com/movies/" + videoTileElement.dataset.orenoid,"_blank"); // Note: dataset name has to be lowercase
                    }
                    else
                        window.open("https://www.iwara.tv/video/" + videoTileElement.dataset.videoid,"_blank"); // Note: dataset name has to be lowercase
                });

                    
            videoTileElement.querySelector(".thumbnail").addEventListener('contextmenu', async e => {
                if(videoTileElement.querySelector(".thumbnail video")) 
                    return;

                let videoElement = document.createElement('video');
                e.preventDefault(); // Stop right click menu from showing up
                let videoUrl = (await IwaraApi.GetVideoData(videoData.videoId)).find(s => s.name == '360').src.view;
                
                videoElement.src = videoUrl;

                videoTileElement.querySelector(".thumbnail img").style.display = "none";
                
                //videoElement.addEventListener('loadedmetadata', e => videoElement.play());
                VideoElementToScrub = videoElement;
                ScrubVideoDuration = videoData.duration > 0 ? videoData.duration : 120;
                videoTileElement.querySelector(".thumbnail").appendChild(videoElement);
                
                return false;
            });

            return videoTileElement;

        } catch (error) {            
            return null;
        }
    }

    /**
     * Based on where the mouse is on the video tile, calculate what part of the video in % we want to scrub to
     * @returns Video scrub position in %
     */
    function GetScrubVideoPosition(videoElement) 
    {        
        const rect = videoElement.getBoundingClientRect();

        // Check if cursor is outside the video bounds
        if (
            mouseCoords.x < rect.left ||
            mouseCoords.x > rect.right ||
            mouseCoords.y < rect.top ||
            mouseCoords.y > rect.bottom
        ) {
            return -1;
        }

        // Calculate horizontal percentage
        const relativeX = mouseCoords.x - rect.left;
        const percent = (relativeX / rect.width) * 100;

        // Return rounded percentage (e.g., 10.2% → 10, 89.8% → 90)
        return Math.round(percent);
    }

    /**
     * Re-render HTML buttons for the stored list of favorite settings
     */
    function RenderFilterFavorites()
    {
        let filterContainerElement = semenDaemonContainerElement.querySelector(".favoriteFilters");
        filterContainerElement.innerHTML = "";

        Config.data.favoriteFilters.sort((a, b) => a.sorting - b.sorting);
        Config.data.favoriteFilters.forEach(filterData => {
            let spanElement = document.createElement('span');
            spanElement.setAttribute("data-query", filterData.query);
            spanElement.innerHTML = filterData.name;
            spanElement.SD_filterData = filterData;
            
            if(filterData.color)
                spanElement.style.backgroundColor = filterData.color;

            // Delete filter
            spanElement.addEventListener('contextmenu', e => {
                
                if(!e.altKey) 
                    return;

                Config.data.favoriteFilters = Config.data.favoriteFilters.filter(f => f !== filterData); // Delete this filter object from the filter list
                Config.SaveConfig();
                RenderFilterFavorites();                                
            })
            
            spanElement.addEventListener('click', e => {
                
                if(e.altKey) // We are editing the filter instead
                {
                    Config.data.favoriteFilters = Config.data.favoriteFilters.filter(f => f !== filterData); // Delete the filter before we edit, so it then just gets re-added as a new filter making it look like an edit. If the edit is not finished, the filter array won't get saved so the deletion won't get applied, so it  can't be accidentaly deleted.
                    document.querySelector("#addNewFilterFavoritePage").style.display = 'block';
                    semenDaemonContainerElement.querySelector('#favoriteFilter_name').value = filterData.name;
                    semenDaemonContainerElement.querySelector('#favoriteFilter_query').value = filterData.query;
                    semenDaemonContainerElement.querySelector('#favoriteFilter_color').value = filterData.color;
                    semenDaemonContainerElement.querySelector('#favoriteFilter_sorting').value = filterData.sorting;                    
                    return;
                }

                queryFieldElement.value = e.target.dataset.query;        
                // Fake enter press on the search field after putting filter query in, so it executes
                queryFieldElement.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter',       // The value of the key pressed
                    code: 'Enter',      // The physical key on the keyboard
                    keyCode: 13,        // Legacy property for "Enter" key
                    charCode: 13,       // Legacy property for "Enter" key
                    bubbles: true,      // Allow the event to bubble up
                    cancelable: true,   // Allow the event to be canceled
                }));
            })

            filterContainerElement.appendChild(spanElement);
        });

        
    }

/*############### Create menu button #################*/

    /**
     * Checks if the menu button to open the search window already exists in the Iwara menu, and if not, it creates it
     */
    function CreateSemenDaemonMenuButton()
    {
        let menuElement = document.querySelector(".menu ul li");

        if(document.querySelector("#semenDaemonMenuButton") || !menuElement)
            return;    
        
        // Menu link icon
        let menuIconElement = document.createElement('img'); 
        menuIconElement.src = "data:image/png;base64,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Uk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAMAUExURQAAAP///1yONQJH+hQMDQkICe7r7lBPUP/9//76/wUCBuXh57+9wPr1/tza3gIABQMCCAkHFgAAA/b2+JWVloKIvAAa4AAp9QAixAAcnBM26AAz/gAt5lhqswA5/gAy8QY23hxAvgA49gg1vkFr7xYdNABA/wFG/wVH/wVJ/ghD8wBK/wBJ/wFK/QFH/AFI+wFH+QJK/wJI/wJJ/QJH+wJH+QVP/wFP/wFM+wNU/wECBB5ImBsvUy1SfAEFBQYHB6WmpkFnWAcLCTBCNkRmSQQFBAwODBITEt7p3gEGADduKA0TCw4iBkmJL0V5ME16OxQfEEBeNRgiFHaBchEYDlVuShhGA1CNNEl3Mh4pGdTW01mhM1uaOTZOKWKAUk59MUhpNE9yOkVjMyU0HGyCX5Gih8TLwGyyP1uNOUhwLlaDOWaZRE92NlR9OktvNDNLIy9DIjtTKys7IYObc01bRGBpWjVmEmaoOF6aNFyTMztfIlyRNV2ROWedP1qJN092MnmzTmCPP0VmLU9yNWGLQkBdLFN2O1p9QnaRYrnAtDtxET9xFkR7Gk6IHk6DI1eTKEJuH0l4JFOGKVuUL12XMWWgNlyQMV+TNGiiOl+VNV2SNG+rPl2QNFqNM2SaOGGXN1yPNFyONGumPWqiPF+TNmGUN16RNlqMNFyNNVyONmWZO1yNNm6mQlWBM16MOFiENWGRO1N9M2ygQ2WVP12JOzxYJnSoSluFO1N3NkxrM1BuODtmFmGdLlmKLWKXNF+UM22lO2ieOl+RNV6ONW2kPmSVOXSvQ12KNlh+N2yiOGebNn+8RE5xLaWxmi9NEAcKBFh2OhgZF2ufMGaTMCIxEHWPU22hJ1h9JuPm32GNHXGiI3quLmqVHnGhG1Z1FU9bM3KDTGJ/C1lkOYmKhnRZSTQyMY5lVV9EO49JNLVwXapqWJ9hUb91Y3tMQJVZTIpWSoVNRzAeHIBoZZpWU/7+/v39/fr6+vPz8+Pj47KysmlpaUJCQiIiIgMDAwEBAf///9aNB2kAAAEAdFJOU////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wBT9wclAAAACXBIWXMAAAsTAAALEwEAmpwYAAAInklEQVRIiX2We3BU1R3HP+c+drOb3YS8SGDJC0N4JCEQXj6BgBAoymjKIIltMSAUO621WKsz2Frr2KrYAbQqEiDaGYJaCK0FNEFBpKBSFAKGQBJBkvCISTbZ7G72bnb33v6xuwiEev66v3O+3895/M79zREGg9uLnfDyDX0rekby0k204kbA0rFTOVz6FIYeu2GkFu1dfIcIKeicvX/fSz8IWJY3QT1YOg4pEtePU4DfzT01JCidZ4Q06rSmfPX2/wX8RSmyfvyf2uuQui4vvv1Kbmx5OKzKDp4oeLfy5oCPTt7WnZ0PcJ+dRGeS27UDgONv3d2rPBhVVXtaEjtevhlgTUr67tb9EH+4OlmAKuSh9fKFHS5g7m86Ayu+n+mv4+beBFD3debhdejS/OfrUzO3knK6/JShJjXfXlvlglkzsq8Squj3/3owYNGt0zvXHkRfMcTt+XegC5Emlvx8Q9pQl9zl2yRTv2nxpcguqoOm1kfVQYBf5KYfXgfH124SGPZIZ8wf9Z4R2R+a1kFZmb2jHKgcGPFBf1yygAuVAEpEujK36JMmYOim7+2gPRXzk5RmqVjfwPb8Yi9Vhqpad5BZ6PKIwJjF78HVhPdKTcoeQLfbv/cD2mZdypFKymDNJ2M3W0bHnN1yy4q8Pinu0clF0xZfs4U1jlNte6A+18qN7QXpXHHGvF5Kp7T6dWwz3LJZlG31m0yjXBt3RAGrsy0TJwMzDw7yw7H95xRlHTyWqhklTU05sd6gat+d00FX6lpVAvjtk1lJo2qBwM38jA5lT49fDe4ZKRktyycoPVKyY8+DHbNzb896GgVoT224I/7QOiDheqdbebS6cWIp93mOOIxEZ4vL+jBoOX3vYi06mXHh1td5DAXYaYntD5x3woAZcAsbgPfV8hxXRV3iAx3y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";
        menuIconElement.width = 32;

        // Clone existing menu link and turn it into our menu link
        let clone = menuElement.cloneNode(true); 
        clone.id = "semenDaemonMenuButton"
        clone.querySelector('a').classList.remove("active")
        clone.querySelector('a div.text').innerHTML = "SemenDaemon"        
        clone.querySelector("svg").replaceWith(menuIconElement)
        clone.addEventListener('click', (e) => {
            
                // Triggered if we are freshly updated the script and coming from an older version possilby
                if(Config.data.version < parseFloat(GM.info.script.version)) // If this is the first time using this addon, show the introduction
                {            
                    semenDaemonContainerElement.querySelector('#changelogContainer').style.display = 'block';
                    Config.data.version = parseFloat(GM.info.script.version);
                    Config.SaveConfig();
                }

                if(videosList.length == 0) // Load the database only when we frist open SD, to save RAM, specially if iwara is open in multiple tabs                
                    TryLoadDatabase();
                                    

                semenDaemonContainerElement.style.display = (semenDaemonContainerElement.style.display == 'block' ? 'none' : 'block');
                queryFieldElement.focus();
                e.preventDefault(); 
                e.stopImmediatePropagation()
            }, false)

        menuElement.parentNode.insertBefore(clone, menuElement.nextElementSibling);

        let updateIconElement = document.createElement('span');
        updateIconElement.id = "dbUpdateMenuIcon";
        updateIconElement.innerHTML = "⬇️";
        updateIconElement.style = "position: absolute; left: -20px; top: -5px; display: none";        
        menuIconElement.parentNode.appendChild(updateIconElement);
        dbUpdateMenuIconElement = updateIconElement;
    }

    // Give the page some time to load and then generate the menu button. Then regenerate it every time iwara script re-renders the menu
    window.addEventListener('load', e => 
            (new MutationObserver((mutationList, observer) => CreateSemenDaemonMenuButton())).observe(document.querySelector("#app"), { attributes: true, childList: true, subtree: true, characterData: true })); // Watch when iwara's JS regenerates te menu, and remake our button               
    
    setInterval(CreateSemenDaemonMenuButton, 500) // Sometimes the onload method doesn't work, so this is a backup

/*############### MAIN PAGE CSS #################*/
    semenDaemonContainerElement.innerHTML += /*html*/`
        <style>
            #semenDaemonContainer 
            {            
                position: absolute;
                top: 60px;
                left: 70px;
                right: 20px;                        
                z-index: 999999;
                border-radius: 10px;
                
                background-color: #1f2228; 
                border: 1px solid #2993e9; 
                padding: 10px;     
                display: none;      
            }
        /* SEARCH STYLES */
            #semenDaemonContainer #searchQuery 
            {
                display: inline-block; 
                width: calc(100% - 50px);
                background-color: #1f2228;
                color: white;
                border: 1px solid #2993e9;
                border-width: 0 2px 0 2px;
                border-radius: 10px;
                font-size: 1em;
                padding: 4px 10px 4px 10px;
                margin-bottom: 10px;
            }

            #semenDaemonContainer #searchQuery:focus
            {
                outline: 1px solid #2993e9;         
            }

            #searchResults 
            {
                display: flex;  
                flex-wrap: wrap;
                gap: 10px
            }

            #searchResults > .videoTile 
            {
                width: 250px; 
                height: 320px; 
                font-weight: bold;
                background-color: #282c34;
                border: 1px solid #7c869a;            
                border-radius: 10px;
                display: grid;
                grid-template-columns: 70px auto;
                grid-template-rows: auto auto 23.3px 23.3px 23.3px;
                grid-template-areas: 
                "thumbnail thumbnail"            
                "title title"
                "pfp uploader"
                "pfp uploaded"
                "pfp metrics"
            }

            #searchResults > .videoTile:hover
            {
                box-shadow: 0px 0px 5px 5px #278ddf;
            }

            #searchResults > .videoTile > .thumbnail /* Thumbnail  image */
            {
                grid-area: thumbnail;            
                
            }

            #searchResults > .videoTile > .thumbnail > img, #searchResults > .videoTile > .thumbnail > video /* Thumbnail  image */
            {
                border-radius: 10px 10px 0 0;
                width: 100%;
                max-height: 180px;
                object-fit: cover;
                
            }


            #searchResults > .videoTile > .title /* Title */
            {
                grid-area: title;            
                font-size: 0.85em
                
            }

            #searchResults > .videoTile > .pfp /* Profile pic */
            {            
                grid-area: pfp;                        
                

            }

            #searchResults > .videoTile > .pfp > img 
            {
                height: 70px;
                width: 70px;
                border-radius: 0px 0 0 10px;
                overflow: hidden;
            }

            #searchResults > .videoTile > .uploader /* Uploader name */
            {
                grid-area: uploader;         
                background-color: #1f2228;   
                
            }        

            #searchResults > .videoTile > .uploaded /* Upload date */
            {
                grid-area: uploaded;            
                font-weight: normal;
                font-size: 0.8em;
                background-color: #1f2228;   

                
            }

            #searchResults > .videoTile > .metrics /* metrics */
            {
                grid-area: metrics;     
                font-size: 0.8em;       
                background-color: #1f2228;   
                border-radius: 0 0 10px 0;
                
            }


            #searchResults > .videoTile > .title,  #searchResults > .videoTile > .metrics, #searchResults > .videoTile > .uploader, #searchResults > .videoTile > .uploaded
            {
                padding: 0 5px 0 5px;
            }

        /* WINDOW STYLES */

            #semenDaemonContainer .semenDaemonPage
            {
                position: absolute;
                top: 20px;
                left: 50%;                
                transform: translate(-50%, 0);
                width: 600px;                    
                z-index: 9999999;
                border-radius: 10px;
                
                background-color: #1f2228; 
                border: 1px solid #2993e9; 
                padding: 10px;   
                display: none;
            }

            #semenDaemonContainer #searchHowto
            {
                width: 1000px;
                top: 90px;
            }

            #semenDaemonContainer .openWindow
            {
                cursor: pointer;
            }

            #semenDaemonContainer .cumpMenu > div
            {
                display: inline-block;
                cursor: pointer;
            }

            #semenDaemonContainer .cumpMenu div:first-child
            {
                width: calc(100% - 120px);
            }

            #semenDaemonContainer .cumpMenu .favoriteFilters
            {
                display: inline-flex;
                flex-wrap: wrap;
                gap: 5px;
                justify: space-evenly;
                margin-bottom: 5px;
            }

            #semenDaemonContainer .cumpMenu .favoriteFilters > span
            {
                border: 1px solid #2993e9; 
                background-color: #282c34;
                padding: 3px 5px 3px 5px;
                border-radius: 10px;
            }

            #semenDaemonContainer .cumpMenu .favoriteFilters > span:hover
            {                 
                background-color: #146fb8 !important;                
            }


            #semenDaemonContainer #addNewFilterFavoritePage
            {
                width: auto;                
                text-align: center;
                
            }

            #semenDaemonContainer #addNewFilterFavoritePage label
            {
                display: inline-block;
                width: 70px;

            }

            #semenDaemonContainer #configContainer input[type=file]
            {
                display: none;
            }

            #semenDaemonContainer .closePage
            {
                position: absolute; 
                right: 10px; 
                top: 10px;
                cursor: pointer;
            }

            #semenDaemonContainer .argName 
            {
                color: #2993e9
            }

            #semenDaemonContainer input[type=text], #semenDaemonContainer input[type=number]
            {                
                background-color: #1f2228;
                color: white;
                border: 1px solid #2993e9;
                border-width: 0 2px 0 2px;
                border-radius: 10px;
                font-size: 1em;             
                margin-bottom: 5px;   
            }

            #semenDaemonContainer input[type=button]
            {                
                border: 1px solid #2993e9;
                color: white;
                background-color: #424855;
                border-radius: 5px;
                padding: 5px;
                font-weight: bold;
            }

            #semenDaemonContainer input[type=button]:hover            
            {
                background-color: #206bd2;
            }
        </style>
        `;

/*############### MAIN PAGE HTML #################*/
    semenDaemonContainerElement.innerHTML += /*html*/`
        <div class="closePage">❌</div>
        <label for="searchQuery">🔎</label><input id="searchQuery">
        <div class="cumpMenu">
            <div class="favoriteFilters"></div>
            <div>                
                <span  class="openWindow addFavoriteFilter" data-page="addNewFilterFavoritePage" title="Save current search query into favorites.\nCtrl + click existing filter to delete it.">➕</span>
                <span  class="openWindow" data-page="searchHowto" title="Show how-to-use instructions for search">📄</span>
                <span  class="openWindow" data-page="introductionContainer" title="Open introduction page">👋</span>
                <span  class="openWindow" data-page="configContainer" title="Open settings page">⚙️</span>
            </div>            
        </div>     
        <div id="searchResults"></div>    
        <div id="addNewFilterFavoritePage" class="semenDaemonPage">
            <label for="favoriteFilter_name">Name:</label><input type="text" id="favoriteFilter_name"><br>
            <label for="favoriteFilter_query">Query:</label><input type="text" id="favoriteFilter_query"><br>
            <label for="favoriteFilter_color">Color:</label><input type="text" placeholder="#282c34" id="favoriteFilter_color" title="Background color to use for this filter button"><br>
            <label for="favoriteFilter_sorting">Sorting:</label><input type="number" id="favoriteFilter_sorting" value="1" title="Filter buttons are sorted by this, so if you set this to 1 and other filters to 2, this one will be displayed first"><br><br>
            <input type="button" value="Add filter">
        </div>    
        

    `;

/*############### CHANGELOG PAGE HTML #################*/
    semenDaemonContainerElement.innerHTML += /*html*/`  
    <div id="changelogContainer" class="semenDaemonPage">
        <div class="closePage">❌</div>
        <h2 style="margin: 0px 0 10px 0">Changelog v1.2</h2>        
        <p><ul>
            <li>You can now recall last searched query, by pressing arrow down in the search field</li>
            <li>Videos can now be previewed by right mouse clicking the thumbanils. You can scrub through the video by moving the mouse cursor left and right on the video tile.</li>   
            <li>Be aware that during low traffic times the video previews load quickly, but during peak load times it can be slow and they can take like 10 seconds to load.</li>   
        </ul></p>
    </div>
    `;

/*############### CONFIG PAGE HTML #################*/
    semenDaemonContainerElement.innerHTML += /*html*/`  
    <div id="configContainer" class="semenDaemonPage">
        <div class="closePage">❌</div>
        <h2 style="margin: 0px 0 10px 0">SemenDaemon Config</h2>        
        <label for="blacklist">Blacklist: <input type="text" placeholder="tag1,tag2,tag3" id="blacklist">
        <h3 style="margin: 10px 0 10px 0">Database update</h3>
        <a id="dbScrapeUpdateProgressButton" style="cursor: pointer">Perform Iwara database update</a>
        <p id="noDbFileFounDerror" style="color: red; display: none; text-align: center; font-weight: bold">Error: No database file was found. You need to import a database file first, you can find it in the same place you got this addon from, it probably came in the same .zip file.</p>
        <h3 id="dbScrapeUpdateProgressBar" style="display: none; text-align: center; font-weight: bold">Spooling up warp drive...</h3>
        <p>This will connect to iwara servers and fetch content catalog pages until the offline database file is fully up to date. 
            Note that if you have active blacklist(on Iwara), or you aren't logged in, then the fetched videos won't include any of thoe blacklisted videos, as Iwara won't serve them. </p>
        <p>Depending on how old your database is, this might take anywhere from few seconds to several minutes. If you close the tab, or go to a different page while the update is happening, all progress will be lost.</p>
        <p>Every time you open SD, if enough time has passed, it will trigger auto database update. Running update is indicated by this iocn: ⬇️ displayed next to SD menu icon. Do NOT close the tab while this icon is displayed or the auto update will fail. If it does fail, you have to trigger manual update here, in order to make auto updates work again. Using SD in other tabs while the update is running in one is fine.</p>
        <h3 style="margin: 10px 0 10px 0">Import / Export data</h3>
        <p>Please note that when importing or exporting the content database file, depending on how much of a potato your PC is, it might take a while (from seconds to few minutes) and the browser window might appear frozen during it.</p>
        <label for="filePicker_db" style="cursor: pointer">[ <a>Import Iwara Database file</a> ]</label><input type="file" accept=".json" id="filePicker_db" >  
        <label for="filePicker_config" style="cursor: pointer">[ <a>Import SemenDaemon config file</a> ]</label><input type="file" accept=".json" id="filePicker_config" ><br>
        <label style="cursor: pointer" id="fileExport_db" >[ <a>Export Iwara Database file</a> ]</label>
        <label style="cursor: pointer" id="fileExport_config" >[ <a>Export SemenDaemon config file</a> ]</label>
    </div>
    `;

/*############### INTRODUCTION PAGE HTML #################*/
    semenDaemonContainerElement.innerHTML += /*html*/`  
    <div id="introductionContainer" class="semenDaemonPage" style="width: 800px; text-align: justify">
        <div class="closePage">❌</div>
        <h2 style="margin: 0px 0 10px 0">Introduction to SemenDaemon</h2>        
        <p>Hi there fren! Looks like you have opened SemenDaemon for the first time, so please make sure you read this wall of text, which will explain everything you need to know about this script.</p>
        <p>Welcome to <b>SemenDaemon</b>, an unofficial addon for Iwara, that aims  to (mostly) replace the slow and sucky default video search tools present on the site. 
            This addon is not meant to be a Iwara's competition, or in any way adversarial to it, but rather to complement its functionality.
        </p>
        <h2 style="margin: 0px 0 10px 0">Features</h2>
        <p>
            <ul>
                <li><b>Instant search</b> - unless your PC is a complete potato, all search results will be displayed nigh instantly</li>
                <li><b>Extensive filtering</b> - You can sort and filter the search results by likes, views, duration, artists, characters, general tags or any combination of them.</li>
                <li><b>Filter favorites</b> - You can store your favorite filter settings as favorites and then apply them with a single click</li>
                <li><b>Improved tagging</b> - SemenDaemon combines tagging from other sites where these videos exist, so even if the video has no tags on iwara, it might still have tags in SemenDaemon's database, allowing you to find videos, which you could never find via Iwara's search</li>
                <li><b>Reducing server load</b> - Because all of the searching happens fully locally on your PC (explained below), it generates much less traffic</li>
            </ul>
        </p>
        <h2 style="margin: 0px 0 10px 0">How does it work?</h2>
        <p> SemenDaemon uses a local content database stored on your computer, and thanks to that all searching and filtering happens fully offline, with no internet needed, and is thus near instanteneous. The only server traffic generated is when your browser loads the thumbnails and profile pictures in search results, or if you perform a database update.          
        </p> 
        
        <p>
            So, in order to use this addon, you need to first import the database file, you can do so, by clicking the gear icon under the search bar on the main page. You can download the database file on the same github page you got this script from. Don't forget to unzip it before you import it.
        </p>
        <p>
        There are some tradeoffs in exchange for the speed you will be getting. Due to the fact that SemenDaemon works with an offline database, the existing entries in the database will not be kept up-to-date, this means that if the uploader changes the title of the video, or the number of likes goes up over time, these changes will not be reflected in the offline database. However, 
        SemenDaemon has the ability to fetch new videos which do not yet exist in its database to keep its catalog up to date (it's just that any further changes to those videos that already exist in the database will not be recorded).
        </p>        
        <h2 style="margin: 0px 0 10px 0">How to search and filter</h2>        
        <p>Instead of cramping it here into the introduction, you can display the filter guide by clicking the 📄 icon under the search bar.</p>
        <h2 style="margin: 0px 0 10px 0">Hotkeys</h2>
        <p>
            <ul>
                <li><span class="argName">Alt + S</span> - Open search window</li>                
                <li><span class="argName">Alt + Click</span> - <i>On a favorite filter</i> - Edit favorite filter</li>                
                <li><span class="argName">Alt + Right click</span> - <i>On a favorite filter</i> - Delete favorite filter</li>                
                <li><span class="argName">Alt + Click</span> - <i>On a video</i> - Open video on Oreno instead of Iwara, if we have oreno ID for that video.</li>               
                <li><span class="argName">Right click</span> - <i>On a video</i> - Play full preview with sound. Use mouse cursor to scrub through the video. If the cursor is in the middle of the video tile, a 3 minute video will start playing from 1:30.</li>     
            </ul>
        </p>
        <h2 style="margin: 0px 0 10px 0">Troubleshooting</h2>        
        <p>
            <ul>
                <li><b>Thumbnail load fail</b> - Some older videos don't have working thumbanils, so those won't load.</li>                                
                <li><b>Brief thumbnail load fail</b> - For videos that use the old thumbnail slideshow preview it will briefly flash the thumbnail fail image, but then starts showing the preview. This is normal. </li>
                <li><b>Video shows up in search results, but doesn't exist on the site</b> -  Video was either deleted, or you don't have perms to access it (you aren't logged it, or have some of its tags blacklisted on Iwara)</li>
                <li><b>Database autoupdate is not working</b> -  If previous autoupdate failed, you have to run it once manually (click settings gear icon) and then autoupdates will work again.</li>
                <li><b>Video previews take forever seconds to load</b> - Be aware that during low traffic times the video previews load quickly, but during peak load times it can be slow and they can take like 10 seconds to load.</li>   
            </ul>
        </p>
        <h2 style="margin: 0px 0 10px 0">Data backup</h2>        
        <p>On the settings page, you will find tools to import and export settings for this addon as well as the database file. Make sure to keep a backup of your settings file, because if you reinstall your browser, or delete cached browser data, specifically the IndexedDB data, you will lose all your stored settings for this addon, as well as the Iwara database data.</p>
        <h2 style="margin: 0px 0 10px 0">In Closing</h2>        
        <p>I hope you will like SemenDaemon and find it useful throughout your gooning MMD adventrues.</p>
        <p><b>SemenDaemon is an unofficial addon and in no way associated with Iwara in any official capacity.</b></p>
        <h2>Happy gooning!</h2>
    </div>
    `;

/*############### SEARCH HOW-TO PAGE HTML #################*/
    semenDaemonContainerElement.innerHTML += /*html*/`  
    <div id="searchHowto", class="semenDaemonPage">        
        <div class="closePage">❌</div>
        <h2 style="margin: 0px 0 10px 0">How to filter</h2>        
        <ul>
            <li><i><span class="argName">+</span>tag1,tag2,tag3</i> - Must have at least ONE of these tags</li>
            <li><i><span class="argName">+&</span>tag1,tag2,tag3</i> - Must have ALL of these tags</li>
            <li><i><span class="argName">-</span>tag1,tag2,tag3</i> - Must not have ANY of these tags, if it has even one of these tags it will not match</li>
            <li><i><span class="argName">+&</span>tag1,tag2,tag3</i> - Must not have ALL of these tags, if it has tag1 and tag2, but not tag3, it will be a positive match</li>
            <li><i><span class="argName">user:</span>user1,user_2</i> - Uploader/user/artist name must match ONE of these. (can be shortened to u:user1)</li>
            <li><i><span class="argName">user-:</span>user1,user_2</i> - Uploader/user/artist name must match NONE of these (can be shortened to u-:user1)</li>
            <li><i><span class="argName">character:</span>character1,character_2</i> - Listed characters must match ONE of these. (can be shortened to c:character)</li>
            <li><i><span class="argName">character&:</span>character1,character_2</i> - All listed characters must be present in character tags (can be shortened to c&:character)</li>
            <li><i><span class="argName">sort:</span>views | likes | artist | date | duration | comments</i> - Sort the results by one of these</li>
            <li><i><span class="argName">sort<:</span>views | likes | artist | date | duration | comments</i> - Sort the results by one of these in asceding order</li>
            <li><i><span class="argName">s:</span>v | l | a | d | u | c</i> - Same as above, but shorter to write</li>
            <li><i><span class="argName">likes | views | duration ></span>NUBMER</i> - Must have more than given amount of likes, views, or be longer than given amount of seconds (you can also use less than <)</li>
            <li><i><span class="argName">l | v | d ></span>NUMBER</i> - Same as above, but shorter to write</li>
            <li><i><span class="argName">oreno:</span>off</i> - Do not use oreno common tag library during tag searches</li>
            <li><i>search query 1 <span class="argName">||</span> search query 2</i> - Combine results from seveal search queries</li>
        </ul>
        <p>You can combine these filters in any way you like.<br> Searches are case insensitive.<br> Filters cannot have spaces in them, you can write "artist name" as "artist_name".<br>You cannot use same type of filter more than once, for example +tag1,tag2 +tag3,tag4.</p>
        <h3 style="margin: 0px 0 10px 0">Examples</h3> 

        <p><b>boob +blender sort:likes</b><br>
        <i>This will match any videos which contain the string boob in their title, have a tag blender and it will sort the results by like count.</i></p>

        <p><b>+blender,miku -futa,insect</b><br>
        <i>This will match any videos which contain the tag blender OR miku and which also DON'T contain any futa or insect tags.</i></p>

        <p><b>Tifa user:MMDPleb,Vamserf</b><br>
        <i>This will match any videos which have the string Tifa in their title and were uploaded by either MMDPleb or Vamserf user.</i></p>

        <p><b>+strip,dance +&mmd,miku likes>1000 sort:views</b><br>
        <i>Finds all videos which have either strip or dance tag, both the mmd AND miku tag and also have more than 1000 likes and sorts the results by views.</i></p>

        <p><b>Fap hero +mmd,blender -&insect,spider views>1000 likes<5000 duration>60 sort:duration</b><br>
        <i>Finds all videos which contain Fap hero in their title, have either mmd or blender tag, don't have BOTH insect AND spider tag, have more than 1000 views, less than 5000 likes, are longer than 60 seconds and sorts them by video length.</i></p>

        <p><b>+strip,dance +mmd likes>200 || hmv -koikatsu views>10000 sort:views</b><br>
        <i>Runs first query at the left side of ||, then the second query at the right side, then combines both result pools and sorts them. You can have as many || (aka OR) segments as you want. Important: Sorting is applied for the entire query, not per segment, this means that only one sort:.. notation can be used for the whole query.</i></p>

    </div>
    `;
/*############### ELEMENT VARS FOR THE IMPORTANT PAGE ELEMENTS #################*/
    // Note this must be done after we amended all the HTML stuff to the page
    const queryFieldElement = semenDaemonContainerElement.querySelector('#searchQuery');    
    const searchResultsContainerElement = semenDaemonContainerElement.querySelector('#searchResults');
    const searchQueryPlaceholders = ["What is your coomer query?", "What are we edging to today?", "Fap time!", "Switching to your side arm is faster than reloading", "Bobs or vegana, whichever will it be?", "Ara ara..."];    
    const blacklistElement = semenDaemonContainerElement.querySelector("#blacklist")    
    const mouseCoords = {x: 0, y: 0};
    var dbUpdateMenuIconElement;

    document.addEventListener('mousemove', (e) => {mouseCoords.x = e.clientX; mouseCoords.y = e.clientY;}); // Keep recording current mouse coordinates
    
    document.body.appendChild(semenDaemonContainerElement);

    
    
/*############### HTML GUI LOGIC STUFF #################*/    
    semenDaemonContainerElement.querySelectorAll(".openWindow").forEach(element => element.addEventListener("click", e => semenDaemonContainerElement.querySelector('#' + e.target.dataset.page).style.display = "block"));
    semenDaemonContainerElement.querySelectorAll(".closePage").forEach(element => element.addEventListener("click", e => e.target.parentElement.style.display = "none"));
    semenDaemonContainerElement.querySelector("#introductionContainer .closePage").addEventListener("click", e => {
        Config.data.showIntroduction = false;
        Config.SaveConfig();
    })    

    // Prefill the favorite filter form query field
    semenDaemonContainerElement.querySelector(".addFavoriteFilter").addEventListener("click", e => 
        {
            semenDaemonContainerElement.querySelector('#favoriteFilter_query').value = queryFieldElement.value;
            semenDaemonContainerElement.querySelector('#favoriteFilter_name').focus();
        });

    // Add new filter
    semenDaemonContainerElement.querySelector("#addNewFilterFavoritePage input[type=button]").addEventListener("click", e => 
        {
            let favoriteFilter = {
                name: semenDaemonContainerElement.querySelector('#favoriteFilter_name').value,
                query: semenDaemonContainerElement.querySelector('#favoriteFilter_query').value,
                color: semenDaemonContainerElement.querySelector('#favoriteFilter_color').value,
                sorting: semenDaemonContainerElement.querySelector('#favoriteFilter_sorting').value,
            };

            if(favoriteFilter.name && favoriteFilter.query)
            {
                Config.data.favoriteFilters.push(favoriteFilter);
                RenderFilterFavorites();
                Config.SaveConfig();     
            }

            semenDaemonContainerElement.querySelector("#addNewFilterFavoritePage").style.display = "none";

        });
    
    // If user picks a json file in the picker, import it as content DB
    semenDaemonContainerElement.querySelector("#filePicker_db").addEventListener("change", async (event) => 
        {
            const file = event.target.files[0];

            if(!file)
                return;

            try 
            {            
                await DB.StoreFileInDB(file, "iwaraDatabase")
                alert("Database file was imported. Refresh page.");
            } 
            catch (error) 
            {
                alert(error)
                console.error("Error:", error);
            }
            
        });

    
    semenDaemonContainerElement.querySelector("#fileExport_config").addEventListener("click", async event => GenerateDownloadFile('semenDaemonConfig_' + (new Date()).toISOString().split('T')[0], JSON.stringify(Config.data))); // Export semenDaemon config into JSON file and offer download to user    
    semenDaemonContainerElement.querySelector("#fileExport_db").addEventListener("click", async event => GenerateDownloadFile('iwaraDB_' + (new Date()).toISOString().split('T')[0], JSON.stringify(videosList))); // Same as above but for the content database 
    
    semenDaemonContainerElement.querySelector("#blacklist").addEventListener("blur", (e) => 
        {
            Config.data.blacklist = e.target.value;
            Config.SaveConfig();        
        });
        
    semenDaemonContainerElement.querySelector("#dbScrapeUpdateProgressButton").addEventListener("click", e => 
        { // Start database update if eligible
            if(videosList.length < 100000)
            {
                semenDaemonContainerElement.querySelector('#noDbFileFounDerror').style.display = "block";
                return;
            }
            
            semenDaemonContainerElement.querySelector('#noDbFileFounDerror').style.display = "none";
            RunDatabaseUpdate();
        });
                    
/*############### HOTKEYS #################*/
    document.addEventListener('keydown', (e) =>  // Global page hotkeys for semenDaemon
        {
            if(!e.altKey || e.key !== 's')
                return;

            document.querySelector("#semenDaemonMenuButton").dispatchEvent(new MouseEvent("click"));

            e.preventDefault();
            e.stopPropagation()
            e.stopImmediatePropagation();
        })

    queryFieldElement.addEventListener('keyup', e => {
        if(e.key != 'ArrowDown')
            return;

        queryFieldElement.value = Config.data.lastSearchedQuery ?? "";
    })
            
/*############### SEARCH INPUT AND FILTERING #################*/
    // Makes callable function on strings via stringvar.adjustForFiltering() and preps the string to be used for filter comparison
    String.prototype.adjustForFiltering = function ()
    {                
        return this.toLowerCase().replaceAll(' ', '_'); 
    };


    queryFieldElement.placeholder = searchQueryPlaceholders[Math.floor(Math.random()*searchQueryPlaceholders.length)];    
    queryFieldElement.addEventListener('keydown', (e) => {
        if(e.key !== 'Enter')
            return;
        
        const TagCategories =
        {
            All: 0,
            IwaraGeneral: 1,
            OrenoGeneral: 2,
            OrenoOrigin: 3,
            OrenoCharacter: 4
        }

        let queryText = e.target.value;

        Config.data.lastSearchedQuery = queryText;
        Config.SaveConfig();

        // Sorting is per whole query, not per segment like the rest of filters, so pull it here, before the segmentation happens
        let sorting = queryText.match(/s(?:ort)?(?<ascending><)?:(?<sortType>[a-z](?:[a-z]{2,10})?)/ui);    

        if(sorting)
            queryText = queryText.replaceAll(sorting[0], '');          

        let orSegments = queryText.split('||');
        let filteredVideosListCombined = [];             
        
        // Run filtering on each segment and then join the results at the end, which will give us the OR filtering
        orSegments.forEach(queryText => 
        {                          
            let filteredVideosList = [];      
            let likesFilter = queryText.match(/l(?:ikes)?(?<operator>[<>=]{1,2})(?<amount>[0-9]{1,9})/ui);
            let viewsFilter = queryText.match(/v(?:iews)?(?<operator>[<>=]{1,2})(?<amount>[0-9]{1,9})/ui);
            let durationFilter = queryText.match(/d(?:uration)?(?<operator>[<>=]{1,2})(?<amount>[0-9]{1,9})/ui);
            let usersFilter = queryText.match(/u(?:ser)?(?<blacklist>-)?:(?<userList>[^\s]+)/ui);
            let charactersFilter = queryText.match(/c(?:haracter)?(?<all>&)?:(?<characterList>[^\s]+)/ui);
            let tagsFilterWhite = queryText.match(/\+(?<all>&)?(?<tagList>[^\s]+)/ui);
            let tagsFilterBlack = queryText.match(/-(?<all>&)?(?<tagList>[^\s]+)/ui); // \p{L} natch all unicode letters             
            let orenoTagsSwitch = queryText.match(/oreno:(?<state>on|off)/ui);

            let tagCategoriesToUse = (orenoTagsSwitch?.groups.state == 'off') ? TagCategories.IwaraGeneral : TagCategories.All;

            filteredVideosList = videosList;
            
            if(likesFilter)
            {
                queryText = queryText.replaceAll(likesFilter[0], '');

                filteredVideosList = filteredVideosList.filter((videoData)=>
                    {
                        switch(likesFilter.groups.operator)
                        {
                            case '=':
                            case '==':
                                return videoData.likes == parseInt(likesFilter.groups.amount);
                                break

                            case '>':
                            case '>=':
                                    return videoData.likes >= parseInt(likesFilter.groups.amount);
                                    break

                            case '<':
                            case '<=':
                                        return videoData.likes <= parseInt(likesFilter.groups.amount);
                                        break

                            default:
                                return false;
                        }
                    }); 
                    
            }

            if(viewsFilter)
            {
                queryText = queryText.replaceAll(viewsFilter[0], '');

                filteredVideosList = filteredVideosList.filter((videoData)=>
                    {
                        switch(viewsFilter.groups.operator)
                        {
                            case '=':
                            case '==':
                                return videoData.views == parseInt(viewsFilter.groups.amount);
                                break

                            case '>':
                            case '>=':
                                    return videoData.views >= parseInt(viewsFilter.groups.amount);
                                    break

                            case '<':
                            case '<=':
                                        return videoData.views <= parseInt(viewsFilter.groups.amount);
                                        break

                            default:
                                return false;
                        }
                    }); 
            }

            if(durationFilter)
                {
                    queryText = queryText.replaceAll(durationFilter[0], '');

                    filteredVideosList = filteredVideosList.filter((videoData)=>
                        {
                            switch(durationFilter.groups.operator)
                            {
                                case '=':
                                case '==':
                                    return videoData.duration == parseInt(durationFilter.groups.amount);
                                    break
        
                                case '>':
                                case '>=':
                                        return videoData.duration >= parseInt(durationFilter.groups.amount);
                                        break
        
                                case '<':
                                case '<=':
                                        return videoData.duration <= parseInt(durationFilter.groups.amount);
                                        break
        
                                default:
                                    return false;
                            }
                        }); 
                }
        
            
            if(usersFilter && !usersFilter.groups.blacklist) // Filter by user (aka uploader, aka artist), uploader has to match at least one of the given names
            {
                queryText = queryText.replaceAll(usersFilter[0], '');
                let userList = usersFilter.groups.userList.adjustForFiltering().split(','); // Make user name lower case, so the search is case insensitive
                
                filteredVideosList = filteredVideosList.filter((videoData) => 
                    {
                        return userList.includes(videoData.uploader.adjustForFiltering()) || userList.includes(videoData.uploaderDisplayName.adjustForFiltering())
                    });
            }

            if(usersFilter && usersFilter.groups.blacklist) // Filter by user (aka uploader, aka artist), uploader has to match NONE of the given names
            {
                queryText = queryText.replaceAll(usersFilter[0], '');
                let userList = usersFilter.groups.userList.adjustForFiltering().split(','); // Make user name lower case, so the search is case insensitive
                
                filteredVideosList = filteredVideosList.filter((videoData) => 
                    {
                        return !userList.includes(videoData.uploader.adjustForFiltering()) && !userList.includes(videoData.uploaderDisplayName.adjustForFiltering())
                    });
            }

            if(tagsFilterWhite && !tagsFilterWhite.groups.all) // At least one tag in list must match
                {
                    queryText = queryText.replaceAll(tagsFilterWhite[0], '');
                    let tagsList = tagsFilterWhite.groups.tagList.adjustForFiltering().split(','); 
                    

                    filteredVideosList = filteredVideosList.filter(videoData => 
                        tagsList.some(videoTag => 
                            (tagCategoriesToUse != TagCategories.OrenoGeneral && videoData.tags.iwaraTags.some(whiteTag => videoTag.adjustForFiltering() === whiteTag.adjustForFiltering())) || 
                            (tagCategoriesToUse != TagCategories.IwaraGeneral && videoData.tags.orenoTags.some(whiteTag => videoTag.adjustForFiltering() === whiteTag.adjustForFiltering()))
                        )
                    );
                }

            if(tagsFilterWhite && tagsFilterWhite.groups.all) // All tags in list much match
            {            
                queryText = queryText.replaceAll(tagsFilterWhite[0], '');
                let tagsList = tagsFilterWhite.groups.tagList.adjustForFiltering().split(','); 
                filteredVideosList = filteredVideosList.filter(videoData => 
                    tagsList.every(videoTag => 
                        (tagCategoriesToUse != TagCategories.OrenoGeneral && videoData.tags.iwaraTags.some(whiteTag => videoTag.adjustForFiltering() === whiteTag.adjustForFiltering())) || 
                        (tagCategoriesToUse != TagCategories.IwaraGeneral && videoData.tags.orenoTags.some(whiteTag => videoTag.adjustForFiltering() === whiteTag.adjustForFiltering()))
                    )
                );
            }

            if(tagsFilterBlack && !tagsFilterBlack.groups.all) // Video tags must NOT contain any  of these tags
            {
                queryText = queryText.replaceAll(tagsFilterBlack[0], '');
                let tagsList = tagsFilterBlack.groups.tagList.adjustForFiltering().split(','); 
                filteredVideosList = filteredVideosList.filter(videoData => 
                    !tagsList.some(videoTag => 
                        (tagCategoriesToUse != TagCategories.OrenoGeneral && videoData.tags.iwaraTags.some(whiteTag => videoTag.adjustForFiltering() === whiteTag.adjustForFiltering())) || 
                        (tagCategoriesToUse != TagCategories.IwaraGeneral && videoData.tags.orenoTags.some(whiteTag => videoTag.adjustForFiltering() === whiteTag.adjustForFiltering()))
                    )
                );
            }

            if(tagsFilterBlack && tagsFilterBlack.groups.all) // Video tags must NOT contain ALL  of these tags
            {
                queryText = queryText.replaceAll(tagsFilterBlack[0], '');
                let tagsList = tagsFilterBlack.groups.tagList.adjustForFiltering().split(','); 
                filteredVideosList = filteredVideosList.filter(videoData => 
                    !tagsList.every(videoTag => 
                        (tagCategoriesToUse != TagCategories.OrenoGeneral && videoData.tags.iwaraTags.some(whiteTag => videoTag.adjustForFiltering() === whiteTag.adjustForFiltering())) || 
                        (tagCategoriesToUse != TagCategories.IwaraGeneral && videoData.tags.orenoTags.some(whiteTag => videoTag.adjustForFiltering() === whiteTag.adjustForFiltering()))
                    )
                );;
            }
            
            if(charactersFilter && !charactersFilter.groups.all) // At least one character in list must match
            {
                queryText = queryText.replaceAll(charactersFilter[0], '');
                let tagsList = charactersFilter.groups.characterList.adjustForFiltering().split(','); 
                

                filteredVideosList = filteredVideosList.filter(videoData => 
                    tagsList.some(videoTag => 
                        videoData.tags.orenoCharacterTags.some(charTag => videoTag.adjustForFiltering() === charTag.adjustForFiltering())                   
                    )
                );
            }

            if(charactersFilter && charactersFilter.groups.all) // All characters in list must match
            {            
                queryText = queryText.replaceAll(charactersFilter[0], '');
                let tagsList = charactersFilter.groups.characterList.adjustForFiltering().split(','); 
                filteredVideosList = filteredVideosList.filter(videoData => 
                    tagsList.every(videoTag => 
                        videoData.tags.orenoCharacterTags.some(charTag => videoTag.adjustForFiltering() === charTag.adjustForFiltering())                   
                    )
                );
            }

            // Global tag blacklist from settings page
            if(blacklistElement && blacklistElement.value) 
            {            
                let tagsList = Config.data.blacklist.adjustForFiltering().split(','); 
                filteredVideosList = filteredVideosList.filter(videoData => 
                    !tagsList.some(videoTag => 
                        (tagCategoriesToUse != TagCategories.OrenoGeneral && videoData.tags.iwaraTags.some(whiteTag => videoTag.adjustForFiltering() === whiteTag.adjustForFiltering())) || 
                        (tagCategoriesToUse != TagCategories.IwaraGeneral && videoData.tags.orenoTags.some(whiteTag => videoTag.adjustForFiltering() === whiteTag.adjustForFiltering()))
                    )
                );
            }




            queryText = queryText.trim();   

            if(queryText) // Title search
            {            
                filteredVideosList = filteredVideosList.filter((videoData) => 
                    {
                        return videoData.title.toLowerCase().includes(queryText.toLowerCase());
                    });
            }

            filteredVideosListCombined = filteredVideosListCombined.concat(filteredVideosList)
        })   
    
        if(sorting)
        {    
            let sortAscending = sorting.groups?.ascending  ? true : false;            
            const sortingFields = {
                v: "views",
                views: "views",
                l: "likes",
                likes: "likes",
                a: "uploaderDisplayName",
                artist: "uploaderDisplayName",
                d: "created",
                date: "created",
                u: "duration",
                duration: "duration",
                c: "commentCount",
                comments: "commentCount",
            }
            
            let sortBy = sortingFields[sorting.groups.sortType] ?? "date";                

            switch(sortBy)
            {
                case 'views':
                case 'likes':
                case 'duration':
                case 'commentCount':                
                    if(!sortAscending)
                        filteredVideosListCombined.sort((a, b) => b[sortBy] - a[sortBy]);
                    else
                        filteredVideosListCombined.sort((a, b) => a[sortBy] - b[sortBy]);
                    break;
                case 'uploaderDisplayName':
                    if(!sortAscending)
                        filteredVideosListCombined.sort((a, b) => a[sortBy].localeCompare(b[sortBy]));
                    else
                        filteredVideosListCombined.sort((a, b) => b[sortBy].localeCompare(a[sortBy]));
                    break;                
                case 'created':                  
                default: // Here 'created' is hardcoded, since if default is triggered it's using some unknown string for sorting so we default to created
                    if(!sortAscending)                    
                        filteredVideosListCombined.sort((a, b) =>  b['created'].getTime() - a['created'].getTime());
                    else
                        filteredVideosListCombined.sort((a, b) =>  a['created'].getTime() - b['created'].getTime());
                    break;                
                    
            }
            
        }
        searchResultsContainerElement.innerHTML = "";
        // Render the video tiles on the screen
        filteredVideosListCombined.slice(0, MaxSearchResults).forEach((videoData) => {
            let videoTileElement = HtmlTileFromVideoData(videoData);

            if(videoTileElement)
                searchResultsContainerElement.appendChild(videoTileElement)
        })
    
    })


/**
 * Handle loading of the content database
 */
async function TryLoadDatabase()
{

    queryFieldElement.disabled = true;
    queryFieldElement.value = "Loading database...";

    let databaseBlobText = await (await DB.RetrieveFileFromDB("iwaraDatabase"))?.text();

    if(databaseBlobText)
        videosList = videosList.concat(JSON.parse(databaseBlobText))    

    if(videosList.length == 0) // No DB file was loaded
    {
        queryFieldElement.disabled = true
        queryFieldElement.value = "You need to import a database file to use SemenDaemon, click on the gear icon"
    }
    
    videosList.forEach(videoData => { // Convert date strings in the content database into Date objects
        if(!(videoData.created instanceof Date))
            videoData.created = new Date(videoData.created);
    })

    queryFieldElement.disabled = false;
    queryFieldElement.value = "";

    AutoDBUpdateTrigger();
}

async function RunDatabaseUpdate()
{
    if(!videosList || videosList.length < 200000)
    {
        alert("SemenDaemon error: Database invalid, missing or too old, cannot update. Import recent IwaraDB file to fix this.");
        return
    }
    
    let progressBarElement = semenDaemonContainerElement.querySelector("#dbScrapeUpdateProgressBar");
    let updateButtonElement = semenDaemonContainerElement.querySelector("#dbScrapeUpdateProgressButton");    
    let latestDBEntryDate = videosList.reduce((latest, obj) => obj.created > latest ? obj.created : latest, new Date(0));
    let apiFetchErrors = []
    let totalPages = 0;
    let totalVideos = 0;
    let loopDate = new Date();
    let pageLimitExceeded = true;

    dbUpdateMenuIconElement.style.display = 'block';

    updateButtonElement.style.pointerEvents = 'none';
    progressBarElement.style.display = 'block';    

    // Save the DB update date here instead of after the update finishes to prevent multiple updates from triggeting at the same time if user opens SD in another tab whilet this update is running
    // The downside is if update gets interrupted it will think it still finished, but manual update will fix that ez
    Config.data.lastDBUpdate = new Date();
    Config.SaveConfig(); 

    pagesLoop:     
    for (let page = 0; page < 3000; page++) 
    {       
        totalPages++;        
        progressBarElement.style.display = 'block';
        
        try 
        {
            const iwaraCatalogPageData = await IwaraApi.GetCatalogPageData(page);

            progressBarElement.innerHTML = `Processed: <br>
            Pages: ${totalPages}<br>
            Videos: ${totalVideos}<br>
            Current date: ${loopDate.toLocaleDateString()}<br>
            Goal date: ${latestDBEntryDate.toLocaleDateString()}<br>
            Errors: ${apiFetchErrors.length}`
            
            videosLoop:
            for (let i = 0; i < iwaraCatalogPageData.results.length; i++) 
            {                
                const videoData = iwaraCatalogPageData.results[i];

                if(latestDBEntryDate >= (new Date(videoData.createdAt)))
                {                                        
                    pageLimitExceeded = false;
                    break pagesLoop;
                }
                
                let newVideoData = 
                {
                    videoId: videoData.id,        
                    title: videoData.title,
                    orenoId: null,
                    description: "",
                    created: new Date(videoData.createdAt),
                    uploaderDisplayName: videoData.user.name,        
                    uploader: videoData.user.username,        
                    rating: videoData.rating,        
                    likes: videoData.numLikes,
                    views: videoData.numViews,
                    commentCount: videoData.numComments,
                    duration: videoData.file?.duration ?? 0,
                    fileId: videoData.file?.id ?? null,
                    fileSize: videoData.file?.size ?? 0,
                    tags: {'iwaraTags':  videoData.tags.map(tag => tag.id), 'orenoTags':[], 'orenoOriginTags': [], 'orenoCharacterTags': []},
                    thumbnailIndex: videoData.thumbnail ?? 0, // Out of list of autogenerated thumbnails available, which one to use
                    customThumbnailLink: videoData.customThumbnail?.name, // Only if uploader uses custom avatar, which only premium users can do, otherwise it's null
                    uploaderAvatarId: videoData.user.avatar?.id ??  null,        
                    uploaderAvatarName: videoData.user.avatar?.name ?? null,        
                    embedUrl: videoData.embedUrl
            
                };            

                loopDate = new Date(videoData.createdAt);

                if(videosList.some(videoData => videoData.videoId == newVideoData.videoId) || videoData.private) // Makes sure we won't be adding a video that already exists in the db                
                    continue;                
                
                videosList.push(newVideoData);
                totalVideos++;
            }
        } 
        catch (error) {            
            apiFetchErrors.push(error)
            console.error('Error fetching data:', error);
        }                

    }

    if(totalVideos > 0)
        DB.StoreLargeStringInDB(JSON.stringify(videosList), 'iwaraDatabase'); // This saves the DB the same way as if it was imported from a file

    if(pageLimitExceeded)
        progressBarElement.innerHTML += '<br><span style="color: red">Error: Reached maximum page limit. Your database file is too old. The scraped entries were still added to the database file, but rest of the videos between Current date and Goal date are going to be missing. Import more recent version of the IwaraDB file to fix this.</span>'

    if(apiFetchErrors.length > 0)
        progressBarElement.innerHTML += `Logged errors: <br>${apiFetchErrors.join('<br>')}`

    progressBarElement.innerHTML += '<br><span style="color: #00bf00">Database update was finished</span>'    
    updateButtonElement.style.pointerEvents = 'auto';
    console.info("SemenDaemon database update finished.")      
    dbUpdateMenuIconElement.style.display = 'none';        
}

/** Check if enough time has passed since last db update and if yes, run another one */
async function AutoDBUpdateTrigger()
{
    let lastDbUpdate = new Date(Config.data.lastDBUpdate ?? 0);
    
    if(((new Date()).getTime() - lastDbUpdate.getTime()) < 6 * 3600 * 1000) 
        return;

    console.info("Triggering DB update since time limit expired. Last update was: " + lastDbUpdate.toLocaleString())
    RunDatabaseUpdate();
}

/*############### IndexedDB API #################*/
    /**
     * Collection of functions which handle interacting with the browser's indexedDB
     */
    class DB
    {
        /**
         * Connect to the indexedDB
         * @returns Active connetion to the indexedDB 
         */
        static #InitDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open("SemenDaemonDB", 1);
        
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains("files")) {
                        const store = db.createObjectStore("files", { keyPath: "id" });
                        store.createIndex("fileName", "fileName", { unique: false });
                    }
                };
        
                request.onsuccess = (event) => resolve(event.target.result);
                request.onerror = (event) => reject(event.target.error);
            });
        }
        
        /**
         * Store a file in the IndexedDB of the browser. Large files will be split into 100MB chunks. RetrieveFileFromDB() then handles joining these chunks automatically upon retrieval.
         * @param {*} file File to store in the db, most likely file from the file picker input
         * @param {string} fileName Name under which to store the file in the DB
         * @returns Promise which resolves once the storing of the file finishes
         */
        static async StoreFileInDB(file, fileName) {
            const CHUNK_SIZE = 100 * 1024 * 1024; // 100MB
            const db = await this.#InitDB();
        
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                const fileChunks = [];
                let offset = 0;
        
                reader.onload = () => {
                    const chunk = reader.result;
                    fileChunks.push(chunk);
        
                    if (offset < file.size) {
                        offset += CHUNK_SIZE;
                        readNextChunk();
                    } else {
                        // Store chunks in IndexedDB
                        const transaction = db.transaction("files", "readwrite");
                        const store = transaction.objectStore("files");
        
                        fileChunks.forEach((chunk, index) => {
                            store.put({ id: `${fileName}-chunk-${index}`, fileName, chunk });
                        });
        
                        store.put({ id: `${fileName}-meta`, fileName, totalChunks: fileChunks.length });
                        transaction.oncomplete = () => resolve();
                        transaction.onerror = (event) => reject(event.target.error);
                    }
                };
        
                reader.onerror = (event) => reject(event.target.error);
        
                function readNextChunk() {
                    const slice = file.slice(offset, offset + CHUNK_SIZE);
                    reader.readAsArrayBuffer(slice);
                }
        
                readNextChunk();
            });
        }

        static async StoreLargeStringInDB(string, fileName) {
            const CHUNK_SIZE = 100 * 1024 * 1024; // 100MB equivalent in characters
            const db = await this.#InitDB();
        
            return new Promise((resolve, reject) => {
                try {
                    const stringChunks = [];
                    let offset = 0;
        
                    // Split the string into chunks
                    while (offset < string.length) {
                        const chunk = string.slice(offset, offset + CHUNK_SIZE);
                        stringChunks.push(chunk);
                        offset += CHUNK_SIZE;
                    }
        
                    // Store chunks in IndexedDB
                    const transaction = db.transaction("files", "readwrite");
                    const store = transaction.objectStore("files");
        
                    stringChunks.forEach((chunk, index) => {
                        store.put({ id: `${fileName}-chunk-${index}`, fileName, chunk });
                    });
        
                    store.put({ id: `${fileName}-meta`, fileName, totalChunks: stringChunks.length });
        
                    transaction.oncomplete = () => resolve();
                    transaction.onerror = (event) => reject(event.target.error);
                } catch (error) {
                    reject(error);
                }
            });
        }
        
        static async RetrieveFileFromDB(fileName) {
            const db = await this.#InitDB();
        
            return new Promise((resolve, reject) => {
                const transaction = db.transaction("files", "readonly");
                const store = transaction.objectStore("files");
        
                // Retrieve metadata to determine the number of chunks
                const metaRequest = store.get(`${fileName}-meta`);
                metaRequest.onsuccess = (event) => {
                    const meta = event.target.result;
                    if (!meta) return resolve(null);
        
                    const totalChunks = meta.totalChunks;
                    const chunks = [];
                    let chunksRetrieved = 0;
        
                    for (let i = 0; i < totalChunks; i++) {
                        const chunkRequest = store.get(`${fileName}-chunk-${i}`);
                        chunkRequest.onsuccess = (chunkEvent) => {
                            chunks[i] = chunkEvent.target.result.chunk;
                            chunksRetrieved++;
        
                            if (chunksRetrieved === totalChunks) {
                                // Combine chunks into a single Blob
                                const fileBlob = new Blob(chunks);
                                resolve(fileBlob);
                            }
                        };
                        chunkRequest.onerror = (event) => reject(event.target.error);
                    }
                };
        
                metaRequest.onerror = (event) => reject(event.target.error);
            });
        }
        
        static async RetrieveStringFromDB(fileName) {
            const db = await this.#InitDB();
        
            return new Promise((resolve, reject) => {
                const transaction = db.transaction("files", "readonly");
                const store = transaction.objectStore("files");
                const request = store.get(fileName);
                request.onsuccess = (event) => resolve(event.target.result?.content || null);
                request.onerror = (event) => reject(event.target.error);

            });
        }        

        /**
         * Store a simple string in the database, max size limit is around 250MB on dekstop browsers. It will not be split into chunks.
         * @param {*} string 
         * @param {*} fileName 
         * @returns 
         */
        static async StoreStringInDB(string, fileName) 
        { 
            const db = await this.#InitDB();

            return new Promise((resolve, reject) => {                            
                const transaction = db.transaction("files", "readwrite");
                transaction.addEventListener('complete', (e) => resolve())                            
                const store = transaction.objectStore("files");
            
                store.put({ id: fileName , content: string });                                
            });
        }
        
    

    }

/*############### Config API + config data #################*/
    class Config
    {
        static data = {
            favoriteFilters: [],
            showIntroduction: true,
            loadImages: true,
            lastSearch: "",
            blacklist: "",
            version: 1.2,
            lastDBUpdate: (new Date()),
            lastSearchedQuery: ""
        };
    
        /**
         * Save currently active config data into broswer DB
         */
        static async SaveConfig()
        {        
            await DB.StoreStringInDB(JSON.stringify(this.data), "config");
            console.info("Cumependium's config data were saved to the IndexedDB");
        }

        /**
         * Save saved config data from browser DB and override any existing
         */
        static async LoadConfig()
        {        
    
            try
            {            
                let configJson = await DB.RetrieveStringFromDB("config")

                if(configJson) 
                    this.data = JSON.parse(configJson);              

                console.info("SemenDaemon's config data were loaded from the IndexedDB");
            }
            catch(e)
            {
                console.error("Error parsing JSON config file for SemenDaemon");
            }                                
        }

        /**
         * Export config data as json and offer them to the user for download
         */
        static ExportConfig()
        {
            GenerateDownloadFile("SemenDaemonConfig-" + (new Date().toISOString().split('T')[0]), JSON.stringify(this.data))
        }

        /**
         * Import config data from a json file
         * @param {*} file Json file from which to import the config data
         */
        static async ImportConfig(file)
        {            
            new Promise((resolve, reject) => {    
                const reader = new FileReader();
                reader.onload = () => {
                    this.data = JSON.parse(reader.result);
                    console.info("SemenDaemon's config data were imported from an external file");
                };

                reader.onloadend = () => resolve();
                reader.onerror = (event) => reject(event.target.error);
                reader.readAsText(file);        
            });
            
        }
    }

/*############### IWARA API #################*/
    class IwaraApi
    {
        /**
         * Retrieve data from the iwara api for the given video catalog page
        * @param {int} page Page number (0 based index)
        */
        static GetCatalogPageData(page = 0) {
            return fetch('https://api.iwara.tv/videos?sort=date&page=' + page, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + apiAccessToken,
                    'Content-Type': 'application/json',
                },
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json(); // Parse JSON
                });
        }

                /**
         * Retrieve data from the iwara api for the given video
        * @param {string} page Page number (0 based index)
        */
        static GetVideoPageData(videoId) {
            return fetch('https://api.iwara.tv/video/' + videoId, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + apiAccessToken,
                    'Content-Type': 'application/json',
                },
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json(); // Parse JSON
                });
        }

        /**
         * Retrieve data for the video player playback
        * @param {string} page Page number (0 based index)
        */
        static async GetVideoData(videoId) 
        {
            let videoPageData = await this.GetVideoPageData(videoId);

            return fetch(videoPageData.fileUrl, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + apiAccessToken,
                    'Content-Type': 'application/json',
                },
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json(); // Parse JSON
                });
        }
    }

    /**
     * Turn string into a file which is then offered to the user for download under the specified filename
     * @param {string} filename 
     * @param {string} text 
     */
    function GenerateDownloadFile(filename, text) 
    {
        // Create a Blob with the text data
        const blob = new Blob([text], { type: "application/json" });
    
        // Create a temporary URL for the Blob
        const url = URL.createObjectURL(blob);
    
        // Create an anchor element
        const a = document.createElement("a");
        a.href = url;
        a.download = filename; // Set the filename for download
    
        // Append the anchor to the document, click it, and remove it
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    
        // Revoke the temporary URL
        URL.revokeObjectURL(url);
    }
    
    // Load stored settings for SemenDaemon
    (async () => {               
        await Config.LoadConfig();    
 
        RenderFilterFavorites();        
        blacklistElement.value = Config.data.blacklist;
        
        if(Config.data.showIntroduction) // If this is the first time using this addon, show the introduction
            semenDaemonContainerElement.querySelector('#introductionContainer').style.display = 'block';
                
        
        
    })();
    
    // Load the content database from browser's IndexedDB into a variable/RAM
    /*(async () => {            
        


        
    })();*/

    queryFieldElement.focus();

    




})();