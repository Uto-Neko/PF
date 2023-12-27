const play = require('play-dl');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, NoSubscriberBehavior, AudioPlayerStatus } = require('@discordjs/voice');

class Music {

        constructor() {
                this.isPlaying = {};
                this.queue = {};
                this.connection = {};
                this.dispatcher = {};
                this.isRepeatSingle = {};
                this.isRepeatQueue = {};
                this.loop = '';
        }

        // 判斷網址是否為播放清單
        isPlayList(url) {
                if (url.indexOf('&list') > -1 && url.indexOf('music.youtube') < 0) {
                        return true;
                }

                return false;
        }
        // 將機器人加入語音、處理歌曲資訊
        async play(interaction) {

                // 語音群的 ID
                const guildID = interaction.guildId;

                // 如果使用者不在語音頻道中則發出警告並返回
                if (interaction.member.voice.channel === null) {
                        interaction.reply({ content: '請先進入語音頻道', ephemeral: true });
                        return;
                }


                // 機器人加入語音
                this.connection[guildID] = joinVoiceChannel({
                        channelId: interaction.member.voice.channel.id,
                        guildId: guildID,
                        adapterCreator: interaction.guild.voiceAdapterCreator
                });

                let musicURL = interaction.options.getString('歌曲連結').trim();
                this.loop = interaction.options.getString('選擇').trim();
                try {

                        // 將歌曲資訊加入隊列
                        if (!this.queue[guildID]) {
                                this.queue[guildID] = [];
                        }

                        let musicName = null;

                        // 檢查是否為播放清單
                        const isPlayList = this.isPlayList(musicURL);
                        if (isPlayList) {

                                // 取得播放清單的資訊
                                const res = await play.playlist_info(musicURL);
                                musicName = res.title;

                                // 取得前 10 筆播放清單的列表歌曲
                                const videoTitles = res.videos.map((v, i) => `[${i + 1}] ${v.title}`).slice(0, 10).join('\n');
                                interaction.channel.send(`>>> **加入播放清單：${musicName}**\nID 識別碼：[${res.id}]\n==========================\n${videoTitles}\n……以及其他 ${res.videos.length - 10} 首歌 `);

                                res.videos.forEach(v => {
                                        this.queue[guildID].push({
                                                id: res.id,
                                                name: v.title,
                                                url: v.url
                                        });
                                });

                        } else {

                                const res = await play.video_basic_info(musicURL);
                                musicName = res.video_details.title;

                                this.queue[guildID].push({
                                        id: res.video_details.id,
                                        name: musicName,
                                        url: musicURL
                                });

                        }
                        if (this.isPlaying[guildID]) {
                                interaction.reply({ content: `歌曲加入隊列：${musicName}` });
                        } else {
                                this.isPlaying[guildID] = true;
                                interaction.reply({ content: `💫現正演唱：${this.queue[guildID][0].name}` });
                                this.playMusic(interaction, this.queue[guildID][0], true);
                        }

                } catch (e) {
                        console.log(e);
                        interaction.reply({ content: '發生錯誤！ 此為錯誤代碼 如果你懷疑是機器人的錯誤 請將此代碼一起回覆:`' + e + '`', ephemeral: true });
                }

        }

        playNextMusic(interaction) {
                const guildID = interaction.guildId;
                if (this.queue[guildID].length > 0) {
                        //console.log(this.queue[guildID][0]);
                        this.playMusic(interaction, this.queue[guildID][0], false);
                } else {
                        this.isPlaying[guildID] = false;
                }
        }

        async playMusic(interaction, musicInfo, isReplied) {
                const guildID = interaction.guildId;

                try {
                        if (!isReplied) {
                                const content = `💫　重複播放音樂：${musicInfo.name}`;
                                interaction.channel.send(content);
                        }

                        const stream = await play.stream(musicInfo.url);
                        const resource = createAudioResource(stream.stream, {
                                inputType: stream.type
                        });

                        const player = createAudioPlayer({
                                behaviors: {
                                        noSubscriber: NoSubscriberBehavior.Play
                                }
                        });

                        player.play(resource);
                        this.connection[guildID].subscribe(player);
                        this.dispatcher[guildID] = player;
                        if (this.loop == 'disable') {
                                this.queue[guildID].shift();
                        }
                        player.on('stateChange', (oldState, newState) => {

                                if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
                                        this.playNextMusic(interaction);
                                }

                        });
                } catch (e) {
                        console.log(e);
                        interaction.channel.send('歌曲發生錯誤...');
                        this.queue[guildID].shift();
                        this.playNextMusic(interaction);
                }

        }


        resume(interaction) {

                const guildID = interaction.guildId;
                if (this.dispatcher[guildID]) {
                        this.dispatcher[guildID].unpause();
                        interaction.reply({ content: '恢復播放' });
                } else {
                        interaction.reply({ content: '機器人目前未加入頻道', ephemeral: true });
                }

        }
        pause(interaction) {

                const guildID = interaction.guildId;
                if (this.dispatcher[guildID]) {
                        this.dispatcher[guildID].pause();
                        interaction.reply({ content: '暫停播放' });
                } else {
                        interaction.reply({ content: '機器人目前未加入頻道', ephemeral: true });
                }

        }
        skip(interaction) {

                const guildID = interaction.guildId;
                if (this.dispatcher[guildID]) {
                        this.dispatcher[guildID].stop();
                        interaction.reply({ content: '跳過目前歌曲' });
                } else {
                        interaction.reply({ content: '機器人目前未加入頻道', ephemeral: true });
                }

        }
        nowQueue(interaction) {

                const guildID = interaction.guildId;
                if (this.queue[guildID] && this.queue[guildID].length > 0) {
                        let queueString = '';
                        let queue = this.queue[guildID].map((item, index) => `[${index + 1}] ${item.name}`);
                        if (queue.length > 10) {
                                queue = queue.slice(0, 10);
                                queueString = `>>> 目前歌單：\n${queue.join('\n')}\n……與其他 ${this.queue[guildID].length - 10} 首歌`;
                        } else {
                                queueString = `目前歌單：\n${queue.join('\n')}`;
                        }

                        interaction.reply({ content: queueString });
                } else {
                        interaction.reply({ content: '目前隊列中沒有歌曲', ephemeral: true });
                }

        }
        deletePlayList(interaction) {
                const guildID = interaction.guildId;
                const id = interaction.options.getString('id').trim();
                this.queue[guildID] = this.queue[guildID].filter(q => q.id !== id);
                interaction.reply({ content: `刪除ID為 ${id} 的播放清單歌曲` });
        }
        leave(interaction) {
                const guildID = interaction.guildId;
                if (this.connection[guildID]) {
                        if (this.queue.hasOwnProperty(guildID)) {
                                delete this.queue[guildID];

                                this.isPlaying[guildID] = false;
                        }
                        this.connection[guildID].disconnect();

                        interaction.reply({ content: '音幻幻離開了頻道' });
                } else {
                        interaction.reply({ content: '音幻幻未加入任何頻道', ephemeral: true });
                }

        }
}
module.exports = new Music();
