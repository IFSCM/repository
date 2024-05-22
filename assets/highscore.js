// highscore.js
const gameVersion = "5.1";
const relay = "https://varied-peggi-coredigital-47cb7fd7.koyeb.app/relay?link=";
const scoreEndpoint = "http://ec2-3-8-192-132.eu-west-2.compute.amazonaws.com:4040";
const restrictAll = false;
const relayedEndpoint = relay + scoreEndpoint;


async function populateHS() {
    // Fetch data from the endpoint
    fetch(relayedEndpoint + '/players/highscores')
        .then(response => response.json())
        .then(data => {
            // Select all elements with the class 'highscore-list'
            const highscoreLists = document.querySelectorAll('.highscore-list');

            // Iterate over each highscore list
            highscoreLists.forEach(highscoreList => {
                // Remove existing content
                highscoreList.innerHTML = '';

                // Check if data is empty
                if (data.length === 0) {
                    // Create a new div for displaying the message
                    const noHighscoreDiv = document.createElement('div');
                    noHighscoreDiv.classList.add('no-highscore');
                    noHighscoreDiv.textContent = 'Much empty';

                    // Append the message to the highscore list
                    highscoreList.appendChild(noHighscoreDiv);

                    return;
                }

                // Populate highscores
                data.forEach(highscore => {
                    const [rank, username, score] = highscore;
                    const highscoreRow = document.createElement('div');
                    highscoreRow.classList.add('highscore-row');

                    // Create elements for rank, username, and score
                    const rankElement = document.createElement('div');
                    rankElement.classList.add('gamerank');
                    rankElement.textContent = rank;

                    const usernameElement = document.createElement('div');
                    usernameElement.classList.add('gameusername');
                    // Create an anchor element
                    const usernameAnchor = document.createElement('a');
                    usernameAnchor.href = `https://twitter.com/${username}`;
                    usernameAnchor.textContent = username;
                    usernameAnchor.target = "_blank";

                    // Append the anchor element to the usernameElement
                    usernameElement.appendChild(usernameAnchor);

                    const scoreElement = document.createElement('div');
                    scoreElement.classList.add('gamescore');
                    scoreElement.textContent = score;

                    // Append elements to highscoreRow
                    highscoreRow.appendChild(rankElement);
                    highscoreRow.appendChild(usernameElement);
                    highscoreRow.appendChild(scoreElement);

                    highscoreList.appendChild(highscoreRow);
                });
            });
        })
        .catch(error => {
            console.error('Error fetching highscores:', error);
        });
}


async function getIPAddress() {
    try {
        // Fetch the JSON data from the URL
        const response = await fetch('https://ipinfo.io/json');

        // Check if the response is successful
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        // Parse the JSON response
        const data = await response.json();
        sessionStorage.setItem("twitter_user_ip", data.ip);

        // Extract and return the IP address from the JSON data
        return data.ip;
    } catch (error) {
        // Log any errors that occur during the fetch
        console.error('Error fetching IP:', error);
        showToast("Toast oombi");
        // Throw the error to handle it in the calling code
        throw error;
    }
}

async function newTwitterToken(state_code) {
    try {
        const param = new URLSearchParams();
        param.append("code", state_code);
        param.append("code_verifier", sessionStorage.getItem("twitter_code_verifier"));
        const queryStr = param.toString();

        const genTokenLink = `${relayedEndpoint}/twitter/get_token?${queryStr}`;
        const response = await fetch(genTokenLink);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        const currentUnixTimeSeconds = Math.floor(Date.now() / 1000);

        // Save it to local storage
        localStorage.setItem("nextUpdate", currentUnixTimeSeconds);
        localStorage.setItem("twitter_token", data.access_token);
        localStorage.setItem("twitter_refresh", data.refresh_token);
        sessionStorage.setItem("isLoggedIn", "true");
        sessionStorage.removeItem("attempt");

        await checkToken(data.access_token);
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}


async function newRefreshToken(refresh_token) {
    const param = new URLSearchParams();
    param.append("refresh_token", refresh_token);
    const queryStr = param.toString();

    const genReTokenLink = `${relayedEndpoint}/twitter/refresh_token?${queryStr}`;
    await fetch(genReTokenLink)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const currentUnixTimeSeconds = Math.floor(Date.now() / 1000);
            // Save it to local storage
            localStorage.setItem("nextUpdate", currentUnixTimeSeconds);
            localStorage.setItem("twitter_token", data.access_token);
            localStorage.setItem("twitter_refresh", data.refresh_token);
            sessionStorage.setItem("isLoggedIn", "true");
            sessionStorage.removeItem("attempt");

            return true;

        })
        .catch(error => {
            console.error('Error fetching data:', error);
            return null;
        });
}


async function uploadMedia(id, url, points) {
    const param = new URLSearchParams();
    param.append("id", id);
    param.append("url", url);
    param.append("points", points);
    const queryStr = param.toString();

    const mediaLink = `${relayedEndpoint}/twitter/upload_media?${queryStr}`;
    await fetch(mediaLink)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            sessionStorage.setItem("twitter_media_id", data.id);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            return null;
        });
}

async function postMedia(text, media_id, token) {
    try {
        const param = new URLSearchParams();
        param.append("text", text);
        param.append("media_id", media_id);
        param.append("token", token);
        const queryStr = param.toString();

        const postLink = `${relayedEndpoint}/twitter/post_tweet?${queryStr}`;
        const response = await fetch(postLink);

        if (!response.ok) {
            if (localStorage.getItem("twitter_token")) {
                //sessionStorage.setItem("attempt", "true");
                return false;
                await postMedia(text, media_id, token);
            } else {
                localStorage.removeItem("twitter_token");
                localStorage.removeItem("twitter_refresh");
                localStorage.removeItem("twitter_pic");
                localStorage.removeItem("twitter_username");
                localStorage.removeItem("twitter_code_challenger");
                localStorage.removeItem("twitter_code_verifier");
                sessionStorage.removeItem("attempt");
                showToast("Error posting media. Removing login session. Please try again.");
                window.location.href = "/";
                throw new Error('Network response was not ok');
            }
        } else {
            const data = await response.json();
            if (data && data.data) {
                showToast("Tweeted Highscore!");
                await accountPoints(scoreValue);
                console.log('Tweet ID:', data.data.id);
                console.log('Tweet Text:', data.data.text);
            }
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        localStorage.removeItem("twitter_token");
        localStorage.removeItem("twitter_refresh");
        localStorage.removeItem("twitter_pic");
        localStorage.removeItem("twitter_username");
        localStorage.removeItem("twitter_code_challenger");
        localStorage.removeItem("twitter_code_verifier");
        showToast("Error posting media. Removing login session. Please try again.");
        window.location.href = "/";
        return null;
    }
}


async function checkToken(token) {
    const param = new URLSearchParams();
    param.append("token", token);
    const queryStr = param.toString();

    console.log("Checking Token:", token);

    const checkTokenLink = `${relayedEndpoint}/twitter/user_info?${queryStr}`;
    await fetch(checkTokenLink)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log(data);
            if (data.username && data.profile_image_url) {
                localStorage.setItem("twitter_username", data.username);
                localStorage.setItem("twitter_pic", data.profile_image_url);
                console.log("Token Verified: ", token);
                sessionStorage.setItem("isLoggedIn", "true");
                return true;
            } else {
                sessionStorage.setItem("isLoggedIn", "false");
                return null;
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
}

async function revokeAccessToken(accessToken) {
    const param = new URLSearchParams();
    param.append("token", accessToken);
    const queryStr = param.toString();

    const revokeTokenLink = `${relayedEndpoint}/twitter/revoke_token?${queryStr}`;
    await fetch(revokeTokenLink)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data && data.revoked === true) {
                console.log('Revoked Token Access:', data);
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            return null;
        });
}



async function tryLogin() {
    // Check if twitter_pic exists in local storage
    let isLoggedIn = false;
    sessionStorage.setItem("isLoggedIn", "false");
    const twitterToken = localStorage.getItem("twitter_token");
    const twitterRefreshToken = localStorage.getItem("twitter_refresh");
    const twitteruname = localStorage.getItem("twitter_username");
    const twitterPic = localStorage.getItem("twitter_pic");

    if (twitterToken && twitterRefreshToken && twitteruname && twitterPic) {
        sessionStorage.setItem("isLoggedIn", "true");
        isLoggedIn = true;
    }

    if (isLoggedIn) {
        // Ensure the DOM is fully loaded before accessing elements
        document.addEventListener("DOMContentLoaded", function () {
            // Get the login button element
            var loginButton = document.getElementById("login-button");
            if (loginButton) {
                // Create a new anchor element
                var loginLink = document.createElement("a");
                // Set href attribute to "#" or any appropriate link
                loginLink.innerHTML = '<img src="' + twitterPic + '" alt="Twitter Profile Picture" class="twitter-profile-pic">';

                // Replace the existing login button with the new anchor element
                loginButton.parentNode.replaceChild(loginLink, loginButton);

                // Add click event listener to the profile picture (inside the anchor element)
                var profilePic = loginLink.querySelector(".twitter-profile-pic");
                profilePic.addEventListener("click", function (event) {
                    event.preventDefault(); // Prevent the default action of the anchor element
                    // Toggle visibility of logout dropdown
                    var logoutDropdown = document.getElementById("logout-dropdown");
                    logoutDropdown.style.display = (logoutDropdown.style.display === "block") ? "none" : "block";
                });
            } else {
                console.error('Login button element not found in the DOM.');
            }
        });
    }
}


async function initiateLogout() {
    await revokeAccessToken(localStorage.getItem("twitter_token"))

    localStorage.removeItem("twitter_token");
    localStorage.removeItem("twitter_refresh");
    localStorage.removeItem("twitter_pic");
    localStorage.removeItem("twitter_username");
    localStorage.removeItem("twitter_code_challenger");
    localStorage.removeItem("twitter_code_verifier");
    showToast("Logged out successfully");
    window.location.href = "/";

}

async function constructAuthURL(action) {

    if (action === "post" && sessionStorage.getItem("isLoggedIn") === "trues") {
        await postSequence();
    } else {
        try {
            const response = await fetch(relayedEndpoint + '/twitter/code_auth');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();

            const fullURL = data.link;
            const currentDateTime = new Date().toString();

            sessionStorage.setItem("dateTime", currentDateTime);
            sessionStorage.setItem("twitter_state", action + data.state);
            sessionStorage.setItem("twitter_code_challenge", data.code_challenge);
            sessionStorage.setItem("twitter_code_verifier", data.code_verifier);

            console.log(fullURL);
            window.location.href = fullURL;
        } catch (error) {
            showToast("Failed to construct OAuth2.0");
            console.error('Error fetching data:', error);
        }
    }

}



function showToast(message) {
    // Create toast element
    var toast = document.createElement("div");
    toast.classList.add("toast");
    toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <span class="toast-close">&times;</span>
  `;

    // Append toast to container
    var container = document.querySelector(".toast-container");
    container.appendChild(toast);

    // Auto close after 5 seconds
    setTimeout(function () {
        if (container.contains(toast)) { // Check if toast is still a child of container
            container.removeChild(toast);
        }
    }, 5000);

    // Close toast when close button is clicked
    var closeButton = toast.querySelector(".toast-close");
    closeButton.addEventListener("click", function () {
        if (container.contains(toast)) { // Check if toast is still a child of container
            container.removeChild(toast);
        }
    });
}
// Function to retrieve the score from the HTML element and log it to the console
async function initHSButton() {
    var shareButtons = document.querySelectorAll("#share-score-button");

    // Iterate through each share button
    for (let button of shareButtons) {
        var innerText = document.querySelector("#share-score").innerText.trim();

        if (innerText === "0") {
            button.disabled = true;
            button.style.opacity = "0.5"; // Example: reduce opacity for visual indication
            button.style.cursor = "not-allowed"; // Example: change cursor style
        } else {
            // Fetch the highest score asynchronously
            try {
                var highestscore = await fetchHighestScore();
                if (restrictAll) {

                    if (parseInt(innerText) > highestscore) {
                        button.disabled = false;
                        button.style.opacity = "1"; // Example: revert opacity
                        button.style.cursor = "pointer"; // Example: revert cursor style
                    }

                } else {
                    button.disabled = false;
                    button.style.opacity = "1"; // Example: revert opacity
                    button.style.cursor = "pointer"; // Example: revert cursor style
                }


            } catch (error) {
                console.error('Error fetching highest score:', error);
            }
        }
    }
}

// Call the function to initialize button state


async function fetchHighestScore() {
    try {
        const response = await fetch(relayedEndpoint + "/players/highscores");
        const textData = await response.text(); // Await the response and read it as text
        const data = JSON.parse(textData); // Parse the text as JSON

        if (data.length === 0) {
            return 0; // If no scores are there, return 0
        } else {
            console.log(data[0][1])
            return data[0][2]; // Return the second element of the first array in the list
        }
    } catch (error) {
        console.error("Error fetching highest score:", error);
        return null; // Return null if there's an error
    }
}

async function accountPoints(scoreValue) {
    const param = new URLSearchParams();
    param.append("ip", sessionStorage.getItem("twitter_user_ip"));
    param.append("score", scoreValue);
    if (localStorage.getItem("twitter_username")) {
        param.append("twitter", localStorage.getItem("twitter_username"));
    }

    const queryStr = param.toString();
    const newLink = `${relayedEndpoint}/players/add?${queryStr}`;

    await fetch(newLink)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            sessionStorage.setItem("twitter_score", scoreValue);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
}

async function logScore() {
    // Get the score element
    var scoreElement = document.querySelector('#gamedisplay > div.score');
    var sidebarScores = document.querySelectorAll('#share-score');

    // Check if the score element exists
    if (scoreElement) {
        // Extract the score value
        var scoreText = scoreElement.innerText;
        var scoreValue = scoreText.split(':')[1].trim();

        sidebarScores.forEach(function (sidebarScore) {
            sidebarScore.innerText = scoreValue;
        });

        await initHSButton();
        sessionStorage.setItem("twitter_score", scoreValue);
        console.log(sessionStorage.getItem("twitter_score"));
        await populateHS();

    } else {
        console.log('Score element not found.');
    }
}

async function getEndpoint() {
    var pathname = window.location.pathname;

    if (pathname === '/callback') {
        const urlParams = new URLSearchParams(window.location.search);
        const state_code = urlParams.get('state');
        const twitter_state = sessionStorage.getItem("twitter_state");
        const code_id = urlParams.get('code');

        console.log("Twitter State:", state_code);
        console.log("Local Twitter State:", twitter_state);
        console.log("Twitter Code:", code_id);

        if (twitter_state.includes(state_code)) {
            //showToast("State success.");

            await newTwitterToken(code_id);
            await tryLogin();

            if (twitter_state.includes("post")) {
                console.log("Ready to Post");
                await postSequence();
            }

        } else {
            showToast("Error. Invalid State.");
        }

    } else if (pathname === '/version') {
        showToast("Game Version:" + gameVersion);
    }
}

async function postSequence() {

    var twit_id = localStorage.getItem("twitter_username");
    var twit_url = localStorage.getItem("twitter_pic");
    var twit_points = sessionStorage.getItem("twitter_score");

    const postText = "I JUST SCORED " + twit_points + " POINTS on @BaseInvaderSol! BaseInvaders is beyond BASED. Will this net me some $BINV tokens? #BaseInvadersSol";
    console.log(twit_points);
    console.log(sessionStorage.getItem("twitter_score"));
    await uploadMedia(twit_id, twit_url, twit_points);
    showToast("Posting... ");
    await postMedia(postText, sessionStorage.getItem("twitter_media_id"), localStorage.getItem("twitter_token"));
}

async function routineProcedure() {
    sessionStorage.setItem("baseinvader_version", gameVersion);
    sessionStorage.removeItem("twitter_score");
    await getIPAddress();
    await tryLogin();
    await initHSButton();
    await populateHS();
    await getEndpoint();
}

// MutationObserver configuration

var observerConfig = { childList: true, subtree: true };

// Callback function to be executed when mutations are observed
var callback = function (mutationsList, observer) {
    for (var mutation of mutationsList) {
        if (mutation.type === 'childList') {
            // Check if the mutation added the "Game Over" element
            if (mutation.addedNodes && mutation.addedNodes.length) {
                for (var i = 0; i < mutation.addedNodes.length; i++) {
                    var addedNode = mutation.addedNodes[i];
                    if (addedNode.nodeName === 'BIG' && addedNode.textContent.trim() === 'Game Over') {
                        // Call the logScore function when the "Game Over" element is added to the DOM
                        logScore();
                        //observer.disconnect();
                        return;
                    }
                }
            }
        }
    }
};

// Create a new observer instance linked to the callback function
var observer = new MutationObserver(callback);

// Start observing the target node for configured mutations
document.addEventListener('DOMContentLoaded', function () {
    observer.observe(document.body, observerConfig);
});

routineProcedure()
