import { OdnTweetData, OdnTweets } from "../../../odnTweets"
import { OdnPlugins, OdnPluginResultData } from "../../../odnPlugins";
import { Log } from "../../../odnUtils";
import { AccountData } from "../../../configs/accountConfigs";
import { OdnSlackUtils } from "../../../odnSlackUtils";

export class HeihachiroDetector {
  constructor(private tweetData: OdnTweetData, private fullName: string) {}

  /**
   * プラグインのメイン処理を実行
   *
   * @param {(isProcessed?: boolean) => void} finish
   */
  run(finish: (isProcessed?: boolean) => void) {
    if (this.isHeihachirable(this.tweetData.text)) {
      const list = [
        this.favoriteTweet(this.tweetData),
        this.retweet(this.tweetData),
        this.notifySlack(this.tweetData)
      ];
      Promise.all(list).then(() => {
        finish();
      });
    }
  }

  /**
   * プラグインを実行するかどうか判定
   *
   * @param {OdnTweetData} tweetData
   * @returns {boolean}
   */
  static isValid(tweetData: OdnTweetData): boolean {
    return false === tweetData.isRetweet && false === this.isMyTweet(tweetData) && this.hasHeihachiro(tweetData.text) ? true : false;
  }

  /**
   * テキスト内に「大塩平八郎」的単語が含まれている可能性があるか
   *
   * @param text
   */
  private static hasHeihachiro(text: string): boolean {
    if (!text) {
      return false;
    }

    return Array.from(Constants.UserName).some((char) => {
      return -1 !== text.indexOf(char);
    });
  }

  /**
   * 自分の投稿か
   *
   * @param tweetData
   */
  private static isMyTweet(tweetData: OdnTweetData): boolean {
    return tweetData.user.idStr === tweetData.accountData.userId;
  }

  /**
   * 「大塩平八郎」っぽいか
   *
   * @param text
   */
  private isHeihachirable(text: string): boolean {
    // 「大塩平八郎」の各単語のindexを配列で取得
    const indexes = Array.from(Constants.UserName).map((char) => {
      const index = text.indexOf(char);
      return -1 !== index ? index : null;
    }).filter((idx) => {
      return null !== idx;
    });

    // 1文字未満のマッチは除外
    if (indexes.length < 2) {
      return false;
    }

    // indexを見て、「大塩平八郎」の並びに則していればtrue
    let currentIndex = 0;
    return indexes.every((idx) => {
      const isPassed = currentIndex <= idx;
      currentIndex = idx;
      return isPassed;
    });
  }

  /**
   * スコアの高いツイートをお気に入り
   *
   * @param tweetData
   */
  private favoriteTweet(tweetData: OdnTweetData): Promise<null> {
    return new Promise((resolve, reject) => {
      const tweet = new OdnTweets(tweetData.accountData);
      tweet.targetTweetId = tweetData.idStr;
      tweet.likeTweetPromise().then(() => {
        resolve(null);
      }).catch((e) => {
        // エラーになってもとりあえず処理を続ける
        Log.w('Error occurred favoriteTweet: ', e);
        resolve(null);
      });
    });
  }

  /**
   * スコアの高いツイートをリツイート
   *
   * @param tweetData
   */
  private retweet(tweetData: OdnTweetData): Promise<null> {
    return new Promise((resolve) => {
      const tweet = new OdnTweets(tweetData.accountData);
      tweet.targetTweetId = tweetData.idStr;
      tweet.retweetPromise().then(() => {
        resolve(null);
      }).catch((e) => {
        // エラーになってもとりあえず処理を続ける
        Log.w('Error occurred retweet: ', e);
        resolve(null);
      });
    });
  }

  /**
   * Slackへ通知
   *
   * @param tweetData
   */
  private notifySlack(tweetData: OdnTweetData): Promise<null> {
    return new Promise((resolve) => {
      OdnSlackUtils.postMessage({
        text: `${Constants.UserName}を検知しました。\n${tweetData.user.name}「${tweetData.text}」`,
        notify: {
          channel: false
        }
      }, (error) => {
        if (error) {
          // エラーになってもとりあえず処理を続ける
          Log.w('Error occurred notifySlack: ', error);
        }
        resolve(null);
      });
    });
  }
}

namespace Constants {
  export const UserName = '大塩平八郎';
}