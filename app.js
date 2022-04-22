const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const jsonMiddleware = express.json();

const dbPath = path.join(__dirname, "twitterClone.db");

const app = express();

app.use(express.json());
app.use(jsonMiddleware);

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 1 DONE
app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const userNameCheckQuery = `
  SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(userNameCheckQuery);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else if (password.length < 6) {
    response.status(400);
    response.send("Password is too short");
  } else {
    const hashedPassword = await bcrypt.hash(request.body.password, 10);
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const dbUser = await db.get(selectUserQuery);
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}'
        )`;
    await db.run(createUserQuery);
    response.status(200);
    response.send("User created successfully");
  }
});

//API 2 DONE
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3 DONE
app.get(
  "/user/tweets/feed/",
  authenticationToken,
  async (request, response) => {
    let { username } = request;
    const loggedUserDetailsQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
    const loggerUserDetails = await db.get(loggedUserDetailsQuery);

    const getUserTweets = `
    SELECT username, tweet, date_time AS dateTime
    FROM tweet INNER JOIN user ON tweet.user_id=user.user_id INNER JOIN follower ON user.user_id = follower.following_user_id
    WHERE follower_user_id = ${loggerUserDetails.user_id}
    ORDER BY date_time DESC
    LIMIT 4;`;
    const userTweets = await db.all(getUserTweets);
    response.send(userTweets);
  }
);

//API 4 DONE
app.get("/user/following/", authenticationToken, async (request, response) => {
  let { username } = request;
  const loggedUserDetailsQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
  const loggerUserDetails = await db.get(loggedUserDetailsQuery);

  const getFollowingUserQuery = `
    SELECT name
    FROM user INNER JOIN follower ON user.user_id = follower.following_user_id
    WHERE follower_user_id = ${loggerUserDetails.user_id}
   ;`;
  const followingUsers = await db.all(getFollowingUserQuery);
  response.send(followingUsers);
});

//API 5 DONE
app.get("/user/followers/", authenticationToken, async (request, response) => {
  let { username } = request;
  const loggedUserDetailsQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
  const loggerUserDetails = await db.get(loggedUserDetailsQuery);

  const getFollowersUserQuery = `
    SELECT name
    FROM user INNER JOIN follower ON user.user_id = follower.follower_user_id
    WHERE following_user_id = ${loggerUserDetails.user_id};`;
  const followersUsers = await db.all(getFollowersUserQuery);
  response.send(followersUsers);
});

//API 6 DONE
app.get("/tweets/:tweetId/", authenticationToken, async (request, response) => {
  const { tweetId } = request.params;
  let { username } = request;

  const loggedUserDetailsQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
  const loggerUserDetails = await db.get(loggedUserDetailsQuery);

  const getFollowingUserQuery = `
    SELECT *
    FROM user INNER JOIN follower ON user.user_id = follower.following_user_id
    WHERE follower_user_id = ${loggerUserDetails.user_id}
   ;`;
  let followingUserIds = [];
  const followingUsers = await db.all(getFollowingUserQuery);
  for (let i of followingUsers) {
    let id = i.user_id;
    followingUserIds.push(id);
  }

  const followingUserTweetCheckQuery = `
  SELECT * FROM tweet WHERE tweet_id = ${tweetId};`;
  const followingUserTweetDetails = await db.get(followingUserTweetCheckQuery);

  if (followingUserTweetDetails.user_id in followingUserIds === false) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const userFollowCheck = `
      SELECT tweet, COUNT(DISTINCT like_id) AS likes, COUNT(DISTINCT reply_id) replies, date_time AS dateTime
      FROM
      tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id
      INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
      WHERE tweet.tweet_id = ${tweetId};`;
    const tweetDetails = await db.get(userFollowCheck);
    response.send(tweetDetails);
  }
});

//API 7 DONE
app.get(
  "/tweets/:tweetId/likes/",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;

    const loggedUserDetailsQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
    const loggerUserDetails = await db.get(loggedUserDetailsQuery);

    const getFollowingUserQuery = `
    SELECT *
    FROM user INNER JOIN follower ON user.user_id = follower.following_user_id
    WHERE follower_user_id = ${loggerUserDetails.user_id}
   ;`;
    let followingUserIds = [];
    const followingUsers = await db.all(getFollowingUserQuery);
    for (let i of followingUsers) {
      let id = i.user_id;
      followingUserIds.push(id);
    }

    const followingUserTweetCheckQuery = `
  SELECT * FROM tweet WHERE tweet_id = ${tweetId};`;
    const followingUserTweetDetails = await db.get(
      followingUserTweetCheckQuery
    );

    if (followingUserTweetDetails.user_id in followingUserIds === false) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const userFollowCheck = `
      SELECT *
      FROM
     like NATURAL JOIN user
      WHERE tweet_id = ${tweetId};`;
      const tweetDetails = await db.all(userFollowCheck);
      let likesList = [];
      for (let i of tweetDetails) {
        likesList.push(i.username);
      }
      let likesUserNames = { likes: likesList };
      response.send(likesUserNames);
    }
  }
);

//API 8 DONE
app.get(
  "/tweets/:tweetId/replies/",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;

    const loggedUserDetailsQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
    const loggerUserDetails = await db.get(loggedUserDetailsQuery);

    const getFollowingUserQuery = `
    SELECT *
    FROM user INNER JOIN follower ON user.user_id = follower.following_user_id
    WHERE follower_user_id = ${loggerUserDetails.user_id}
   ;`;
    let followingUserIds = [];
    const followingUsers = await db.all(getFollowingUserQuery);
    for (let i of followingUsers) {
      let id = i.user_id;
      followingUserIds.push(id);
    }

    const followingUserTweetCheckQuery = `
  SELECT * FROM tweet WHERE tweet_id = ${tweetId};`;
    const followingUserTweetDetails = await db.get(
      followingUserTweetCheckQuery
    );

    if (followingUserTweetDetails.user_id in followingUserIds === false) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const userFollowCheck = `
      SELECT *
      FROM
     reply NATURAL JOIN user
      WHERE tweet_id = ${tweetId};`;
      let replyList = [];
      const tweetDetails = await db.all(userFollowCheck);
      for (let i of tweetDetails) {
        let name = i.name;
        let reply = i.reply;
        replyList.push({ name, reply });
      }
      let followingReplies = { replies: replyList };
      response.send(followingReplies);
    }
  }
);

//API 9
app.get("/user/tweets/", authenticationToken, async (request, response) => {
  let { username } = request;
  const { tweetId } = request.params;
  const loggedUserDetailsQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
  const loggerUserDetails = await db.get(loggedUserDetailsQuery);

  const getUserLikeQuery = `
    SELECT tweet, COUNT(tweet.tweet_id) AS likes, COUNT(DISTINCT reply.reply_id) AS replies, date_time AS dateTime
    FROM
    tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id
    INNER JOIN reply ON tweet.tweet_id=reply.tweet_id
    WHERE tweet.user_id=${loggerUserDetails.user_id}
    GROUP BY tweet.tweet_id;`;
  const userTweets = await db.all(getUserLikeQuery);
  response.send(userTweets);
});

//API 10 DONE
app.post("/user/tweets/", authenticationToken, async (request, response) => {
  const { tweet } = request.body;
  const postNewTweet = `
    INSERT INTO
    tweet (tweet)
  VALUES ('${tweet}');`;
  await db.run(postNewTweet);
  response.send("Created a Tweet");
});

//API 11 DONE
app.delete(
  "/tweets/:tweetId/",
  authenticationToken,
  async (request, response) => {
    let { username } = request;
    const { tweetId } = request.params;
    const loggedUserDetailsQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
    const loggerUserDetails = await db.get(loggedUserDetailsQuery);
    const getUserAndTweetIdQuery = `
    SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`;
    const userIdFromTweetId = await db.get(getUserAndTweetIdQuery);

    if (userIdFromTweetId.user_id === loggerUserDetails.user_id) {
      const deleteTweetQuery = `
        DELETE FROM
        tweet
        WHERE
        tweet_id = '${tweetId}';`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
