// @ts-check

const fetch = require("node-fetch").default
const luxon = require("luxon")
const semver = require("semver")

/**
 * @returns {Promise<string>}
 */
async function getLastBuildStartTime() {
  console.log("getting last build time of", process.env.OWN_GITHUB_REPO)
  const res = await fetch(
    `https://circleci.com/api/v1.1/project/github/${process.env.OWN_GITHUB_REPO}?circle-token=${process.env.CIRCLE_TOKEN}&filter=successful&limit=1`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  )
  const results = await res.json()
  // first time around there won't be any previous builds
  console.log({ results })
  if (!results[0]) {
    process.exit(0)
  }
  console.log("got last build time of", results[0].start_time)
  return results[0].start_time
}

/**
 * @returns {Promise<{latestVersion: string, publishedAt: string}>}
 */
async function getLatestVersion() {
  console.log("getting latest version of", process.env.PACKAGE_NAME)
  const res = await fetch(
    `https://registry.npmjs.org/${process.env.PACKAGE_NAME}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  )
  const data = await res.json()
  const versions = Object.keys(data.versions)
  versions.sort((a, b) => {
    if (semver.lt(a, b)) {
      return -1
    } else if (semver.gt(a, b)) {
      return 1
    } else {
      return 0
    }
  })

  const latestVersion = versions[versions.length - 1]

  console.log("got latest version", latestVersion)

  return { latestVersion, publishedAt: data.time[latestVersion] }
}

async function run() {
  console.log("Running check!")
  const { latestVersion, publishedAt } = await getLatestVersion()
  const lastBuildStartTime = await getLastBuildStartTime()
  if (
    luxon.DateTime.fromISO(publishedAt) >
    luxon.DateTime.fromISO(lastBuildStartTime)
  ) {
    console.log("sending slack message")
    // send slack massage
    fetch(`${process.env.SLACK_WEBHOOK_URL}`, {
      method: "POST",
      body: JSON.stringify({
        text: `:sparkles: *Today is a magical day* :sparkles:

A new version of *${process.env.PACKAGE_NAME}* was just published! (${latestVersion})

:sun_with_face: :rainbow: :danceman: :soon: ${process.env.RELEASES_URL}`,
      }),
    })
  } else {
    console.log("not sending slack message")
  }
}

console.log("CIRCLE_BRANCH", process.env.CIRCLE_BRANCH)
console.log("NODE_ENV", process.env.NODE_ENV)
if (
  process.env.CIRCLE_BRANCH === "master" ||
  process.env.NODE_ENV === "development"
) {
  run()
}
