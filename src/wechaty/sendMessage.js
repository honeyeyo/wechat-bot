import dotenv from 'dotenv'
// 加载环境变量
dotenv.config()
const env = dotenv.config().parsed // 环境参数

// 从环境变量中导入机器人的名称
const botName = env.BOT_NAME

// 从环境变量中导入需要自动回复的消息前缀，默认配空串或不配置则等于无前缀
const autoReplyPrefix = env.AUTO_REPLY_PREFIX ? env.AUTO_REPLY_PREFIX : ''

// 从环境变量中导入联系人白名单
const aliasWhiteList = env.ALIAS_WHITELIST ? env.ALIAS_WHITELIST.split(',') : []

// 从环境变量中导入群聊白名单
const roomWhiteList = env.ROOM_WHITELIST ? env.ROOM_WHITELIST.split(',') : []

import { getServe } from './serve.js'

/**
 * 默认消息发送
 * @param msg
 * @param bot
 * @param ServiceType 服务类型 'GPT' | 'Kimi'
 * @returns {Promise<void>}
 */
export async function defaultMessage(msg, bot, ServiceType = 'GPT') {
  const getReply = getServe(ServiceType)
  const contact = msg.talker() // 发消息人
  const receiver = msg.to() // 消息接收人
  const content = msg.text() // 消息内容
  const room = msg.room() // 是否是群消息
  const roomName = (await room?.topic()) || null // 群名称
  const alias = (await contact.alias()) || (await contact.name()) // 发消息人昵称
  const remarkName = await contact.alias() // 备注名称
  const name = await contact.name() // 微信名称
  const isText = msg.type() === bot.Message.Type.Text // 消息类型是否为文本
  const isRoom = roomWhiteList.includes(roomName) && content.includes(`${botName}`) // 是否在群聊白名单内并且艾特了机器人
  const isAlias = aliasWhiteList.includes(remarkName) || aliasWhiteList.includes(name) // 发消息的人是否在联系人白名单内
  const isBotSelf = botName === `@${remarkName}` || botName === `@${name}` // 是否是机器人自己
  // TODO 你们可以根据自己的需求修改这里的逻辑
  if (isBotSelf || !isText) return // 如果是机器人自己发送的消息或者消息类型不是文本则不处理
  try {
    // 群聊消息处理
    if (isRoom && room) {
      const cleanContent = content.replace(`${botName}`, '').trimStart()

      // 1. 先检查是否匹配关键字
      const response = await handleKeywordMatch(cleanContent)
      if (response) {
        await room.say(response)
        return
      }

      // 2. 如果没有匹配关键字，且带有AI前缀，则使用AI回复
      if (cleanContent.startsWith(`${autoReplyPrefix}`)) {
        const question = (await msg.mentionText()) || cleanContent.replace(`${autoReplyPrefix}`, '')
        const aiResponse = await getReply(question)
        await room.say(aiResponse)
      }
    }

    // 私聊消息处理
    if (isAlias && !room) {
      const cleanContent = content.trimStart()

      // 1. 先检查是否匹配关键字
      const response = await handleKeywordMatch(cleanContent)
      if (response) {
        await contact.say(response)
        return
      }

      // 2. 如果没有匹配关键字，且带有AI前缀，则使用AI回复
      if (cleanContent.startsWith(`${autoReplyPrefix}`)) {
        const question = cleanContent.replace(`${autoReplyPrefix}`, '')
        const aiResponse = await getReply(question)
        await contact.say(aiResponse)
      }
    }
  } catch (e) {
    console.error(e)
  }
}

/**
 * 关键字匹配处理函数
 */
async function handleKeywordMatch(content, contact = null) {
  // 去除首尾空格
  content = content.trim()

  // 测试日志
  console.log('收到消息:', content)

  // 在线玩家查询
  if (content === '在线玩家') {
    return await getOnlinePlayers()
  }

  // 玩家查询 - 匹配"查询xxx"
  if (content.startsWith('查询')) {
    const nickname = content.substring(2).trim()
    if (nickname) {
      return await getPlayerInfo(nickname)
    }
  }

  // 排行榜查询
  if (content === '排行榜') {
    return await getLeaderboard(10)
  }
  if (content.startsWith('排行榜')) {
    const num = content.substring(3).trim()
    if (/^\d+$/.test(num)) {
      return await getLeaderboard(parseInt(num))
    }
  }

  // 在线高手/低手查询
  if (content.startsWith('在线高手')) {
    const num = content.substring(4).trim()
    if (/^\d+$/.test(num)) {
      return await getOnlineElitePlayers(parseInt(num))
    }
  }
  if (content.startsWith('在线低手')) {
    const num = content.substring(4).trim()
    if (/^\d+$/.test(num)) {
      return await getOnlineLowPlayers(parseInt(num))
    }
  }

  // 群排行榜
  if (content === '群排行榜') {
    return await getGroupLeaderboard(10)
  }
  if (content.startsWith('群排行榜')) {
    const num = content.substring(4).trim()
    if (/^\d+$/.test(num)) {
      return await getGroupLeaderboard(parseInt(num))
    }
  }

  // 好友列表查询
  if (content.startsWith('好友列表')) {
    const nickname = content.substring(4).trim()
    return await getFriendList(nickname || (contact ? await contact.name() : null))
  }

  // 在线好友查询
  if (content.startsWith('在线好友')) {
    const nickname = content.substring(4).trim()
    return await getOnlineFriendList(nickname || (contact ? await contact.name() : null))
  }

  // 战绩统计
  if (content.startsWith('战绩统计')) {
    const params = content.substring(4).trim().split(/\s+/)
    if (params[0]) {
      const nickname = params[0]
      const games = params[1] && /^\d+$/.test(params[1]) ? parseInt(params[1]) : 10
      return await getPlayerStats(nickname, games)
    }
  }

  // 对局统计
  if (content.startsWith('对局统计')) {
    const params = content
      .substring(4)
      .trim()
      .split(/[\s_]+/)
    if (params.length >= 2) {
      return await getMatchupStats(params[0], params[1])
    }
  }

  // 个人周报
  if (content.startsWith('个人周报')) {
    const nickname = content.substring(4).trim()
    return await getWeeklyReport(nickname || (contact ? await contact.name() : null))
  }

  // 个人日报
  if (content.startsWith('个人日报')) {
    const nickname = content.substring(4).trim()
    return await getDailyReport(nickname || (contact ? await contact.name() : null))
  }

  // 帮助信息
  if (content.includes('帮助')) {
    return getHelpMessage()
  }

  return null
}

/**
 * 获取帮助信息
 */
function getHelpMessage() {
  return `可用命令：
1. 在线玩家 - 查看群友实时在线状态
2. 查询 [昵称] - 查询玩家详细信息(如：查询VP)
3. 排行榜 - 查看世界前十名
4. 排行榜 [N] - 查看世界前N名
5. 在线高手 [N] - 查看在线ELO>2000的前N名
6. 在线低手 [N] - 查看在线ELO<1500的前N名
7. 群排行榜 - 查看群内前10名
8. 群排行榜 [N] - 查看群内前N名
9. 好友列表 [昵称] - 查看指定玩家的好友列表
10. 在线好友 [昵称] - 查看指定玩家的在线好友
11. 战绩统计 [昵称] [场数] - 查询最近N场比赛统计
12. 对局统计 [昵称1] [昵称2] - 查询两玩家对局统计
13. 个人周报 [昵称] - 查询上周统计数据
14. 个人日报 [昵称] - 查询昨日统计数据
15. AI对话 - 发送"${autoReplyPrefix} 你的问题"

注：[] 表示可选参数，不带昵称的命令默认查询发送者信息`
}

// 以下是各个功能的接口定义，需要你根据实际情况实现
async function getOnlinePlayers() {
  // 实现获取在线玩家逻辑
  return '在线玩家'
}

async function getPlayerInfo(nickname) {
  // 实现获取玩家���息逻辑
  return `玩家信息 ${nickname}`
}

async function getLeaderboard(limit) {
  // 实现获取排行榜逻辑
  return `排行榜 ${limit}`
}

async function getOnlineElitePlayers(limit) {
  // 实现获取在线高手逻辑
  return `在线高手 ${limit}`
}

async function getOnlineLowPlayers(limit) {
  // 实现获取在线低手逻辑
  return `在线低手 ${limit}`
}

async function getGroupLeaderboard(limit) {
  // 实现获取群排行榜逻辑
  return `群排行榜 ${limit}`
}

async function getFriendList(nickname) {
  // 实现获取好友列表逻辑
  return `好友列表 ${nickname}`
}

async function getOnlineFriendList(nickname) {
  // 实现获取在线好友列表逻辑
  return `在线好友列表 ${nickname}`
}

async function getPlayerStats(nickname, games) {
  // 实现获取战绩统计逻辑
  return `战绩统计 ${nickname} ${games}`
}

async function getMatchupStats(nickname1, nickname2) {
  // 实现获取对局统计逻辑
  return `对局统计 ${nickname1} ${nickname2}`
}

async function getWeeklyReport(nickname) {
  // 实现获取周报逻辑
  return `个人周报 ${nickname}`
}

async function getDailyReport(nickname) {
  // 实现获取日报逻辑
  return `个人日报 ${nickname}`
}

/**
 * 分片消息发送
 * @param message
 * @param bot
 * @returns {Promise<void>}
 */
export async function shardingMessage(message, bot) {
  const talker = message.talker()
  const isText = message.type() === bot.Message.Type.Text // 消息类型是否为文本
  if (talker.self() || message.type() > 10 || (talker.name() === '微信团队' && isText)) {
    return
  }
  const text = message.text()
  const room = message.room()
  if (!room) {
    console.log(`Chat GPT Enabled User: ${talker.name()}`)
    const response = await getChatGPTReply(text)
    await trySay(talker, response)
    return
  }
  let realText = splitMessage(text)
  // 如果是群聊但不是指定艾特人那么就不进行发送消息
  if (text.indexOf(`${botName}`) === -1) {
    return
  }
  realText = text.replace(`${botName}`, '')
  const topic = await room.topic()
  const response = await getChatGPTReply(realText)
  const result = `${realText}\n ---------------- \n ${response}`
  await trySay(room, result)
}

// 分片长度
const SINGLE_MESSAGE_MAX_SIZE = 500

/**
 * 发送
 * @param talker 发送哪个  room为群聊类 text为单人
 * @param msg
 * @returns {Promise<void>}
 */
async function trySay(talker, msg) {
  const messages = []
  let message = msg
  while (message.length > SINGLE_MESSAGE_MAX_SIZE) {
    messages.push(message.slice(0, SINGLE_MESSAGE_MAX_SIZE))
    message = message.slice(SINGLE_MESSAGE_MAX_SIZE)
  }
  messages.push(message)
  for (const msg of messages) {
    await talker.say(msg)
  }
}

/**
 * 分组消息
 * @param text
 * @returns {Promise<*>}
 */
async function splitMessage(text) {
  let realText = text
  const item = text.split('- - - - - - - - - - - - - - -')
  if (item.length > 1) {
    realText = item[item.length - 1]
  }
  return realText
}

// 添加一个测试函数
async function testMatching() {
  const testCases = [
    '查询VP',
    '查询 VP',
    '排行榜10',
    '排行榜 10',
    '在线高手5',
    '在线高手 5',
    '群排行榜3',
    '群排行榜 3',
    '好友列表VP',
    '好友列表 VP',
    '战绩统计VP',
    '战绩统计VP 10',
    '战绩统计 VP 10',
    '对局统计VP_CHN',
    '对局统计VP CHN',
    '个人周报VP',
    '个人周报 VP',
  ]

  for (const test of testCases) {
    console.log(`测试命令: ${test}`)
    const result = await handleKeywordMatch(test)
    console.log(`匹配结果: ${result ? '成功' : '失败'}\n`)
  }
}
