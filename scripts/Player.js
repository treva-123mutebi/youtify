﻿
function Player() {
    var self = this;
    self.initialized = false;
    self.players = [];
    self.currentVideo = null;
    self.currentVideoLength = 0;
    self.volume = 100;
    self.currentPlayer = null;
    self.inFullScreen = false;
    
    /* Init the player */
    self.init = function() {
        /* Wait for APIs */
        if (!youTubeApiReady) {
            setTimeout(function() {
                self.init();
            }, 1000);
            return;
        }
    
        self.players.push({type: 'yt', player : new YouTubePlayer(), initialized: false});
        
        EventSystem.addEventListener('video_failed_to_play', self.findAndPlayAlternative);
        EventSystem.addEventListener('video_played_to_end', function() {
            Timeline.stop();
            self.next();
			$('body').removeClass('playing');
        });
        EventSystem.addEventListener('video_started_playing_successfully', function() {
            Timeline.start();
            $('#bottom .info, #bottom .share-wrapper').show();
            if (self.currentPlayer) {
                self.currentVideoLength = self.currentPlayer.getTotalPlaybackTime();
            }
        });
        
        self.initialized = true;
        EventSystem.callEventListeners('player_initialized', self);
    };
        
    /* Start (or if video is null resume) playback of a video */
    self.play = function(video) {
        var i = 0;
        
        /* Play called without argument */
        if (video === null || video === undefined) {
            if (self.currentPlayer) {
                self.currentPlayer.play();
                Timeline.start();
                $('body').addClass('playing');
            } else {
                console.log("Player.play() was called but Player.currentPlayer is null");
                return;
            }
        } else {
            /* Assume YouTube video type if not set */
            if (video.type === null || video.type.length === 0) {
                video.type = 'yt';
            }
            
            /* Remove reference to currentPlayer to discover an eventual video type error */
            self.currentPlayer = null;
            
            /* Display the right player and init if uninitialized */
            for (i = 0; i < self.players.length; i+=1) {
                if (self.players[i].type === video.type) {
                    /* Init the player and start playing the video on callback */
                    if (self.players[i].initialized === false) {
                        self.players[i].player.init(function() {
                            self.players[i].initialized = true;
                            self.configurePlayer(self.players[i]);
                            self.play(video);
                        });
                        return;
                    } else {
                        /* We found the right player! */
                        self.currentPlayer = self.players[i].player;
                        self.currentPlayer.show();
                    }
                } else {
                    /* Hide other players */
                    self.players[i].player.hide();
                }
            }
            
            /* Couldn't find a player to go with the video */
            if (self.currentPlayer === null) {
                console.log("Player.play(): Could not find matching player to video type: " + video.type);
                return;
            } else {
                /* Everything seems to be in order. Play the video! */
                self.currentVideo = video;
                self.currentPlayer.play(video);
                Timeline.start();
                $('body').addClass('playing');
            }
        }
    };
    
    /* Configure the player to match other players */
    self.configurePlayer = function(playerItem) {
        if (!playerItem.initialized) {
            console.log("Player.configurePlayer(playerItem): playerItem is not initialized");
            return;
        }
        
        playerItem.player.setVolume(self.volume);
        if (self.inFullScreen) {
            playerItem.player.fullScreenOn();
        } else {
            playerItem.player.fullScreenOff();
        }
    };
    
    /* Pauses the current video */
    self.pause = function() {
        if (self.currentPlayer === null || self.currentVideo === null) {
            console.log("Player.pause(): currentPlayer or currentVideo is null");
            return;
        } else {
            Timeline.stop();
            $('body').removeClass('playing');
            $('body').addClass('paused');
            self.currentPlayer.pause();
        }
    };
    
    /* Pauses or plays the current video */
    self.playPause = function() {
        if (self.currentPlayer === null || self.currentVideo === null) {
            console.log("Player.playPause(): currentPlayer or currentVideo is null");
            return;
        } else {
            self.currentPlayer.playPause();
        }
    };
    
    /* Play previous video */
    self.prev = function() {
        if (self.currentPlayer === null || self.currentVideo === null) {
            console.log("Player.prev(): currentPlayer or currentVideo is null");
            return;
        }
        if (self.getCurrentPlaybackTime() > 3) {
			self.seekTo(0);
		} else {
            Queue.playPrev();
		}
    };
    
    /* Play next video */
    self.next = function() {
        var elem;
        if (self.currentPlayer === null || self.currentVideo === null) {
            console.log("Player.next(): currentPlayer or currentVideo is null");
            return;
        }
        
        /* First try the queue */
        if (Queue.playNext()) {
			return;
		} else {
            /* Else play next anyway or load more */
            elem = $('#right .playing').next();
            if (elem.hasClass('alternative')) {
                elem = elem.parent().parent().next();
            } else if (elem.hasClass('loadMore')) {
                // load more and continue playing
                elem.addClass('loading');
                Search.searchVideos('', true, true);
            }
            if (elem.length > 0) {
                elem.data('model').play();
            }
        }
    };
    
    /* Toggles the fullscreen */
    self.toggleFullScreen = function() {
        if (self.inFullScreen) {
            self.fullScreenOff();
        } else {
            self.fullScreenOn();
        }
    };
    
    /* Enter fullScreen */
    self.fullScreenOn = function() {
        self.inFullScreen = true;
        
        for (i = 0; i < self.players.length; i+=1) {
            if (self.players[i].initialized) {
                self.players[i].player.fullScreenOn();
            }
        }
    };
    
    /* Exit fullScreen */
    self.fullScreenOff = function() {
        self.inFullScreen = false;
        
        for (i = 0; i < self.players.length; i+=1) {
            if (self.players[i].initialized) {
                self.players[i].player.fullScreenOff();
            }
        }
    };
    
    /* Set volume (0-100) */
    self.setVolume = function(volume) {
        var i;
        if (volume < 0 || volume > 100) {
            console.log("Player.setVolume("+ volume + "): argument must be >= 0 && <= 100");
            return;
        }
        self.volume = volume;
        
        for (i = 0; i < self.players.length; i+=1) {
            if (self.players[i].initialized) {
                self.players[i].player.setVolume(volume);
            }
        }
    };
    
    /* Get volume (0-100) */
    self.getVolume = function() {
        return self.volume;
    };
    
    /* Increase or decrease the volume */
    self.setRelativeVolume = function(volume) {
        volume += self.getVolume();
        if (volume <= 0) {
            self.setVolume(0);
        } else if (volume >= 100) {
            self.setVolume(100);
        } else {
            self.setVolume(volume);
        }
    }
    
    /* Seek to time (seconds) in video */
    self.seekTo = function(time) {
        if (self.currentPlayer === null || self.currentVideo === null) {
            console.log("Player.seekTo(): currentPlayer or currentVideo is null");
            return;
        } else {
            if (time >= 0 && time <= self.getTotalPlaybackTime()) {
                self.currentPlayer.seekTo(time);
            } else {
                console.log("Player.seekTo("+ time + "): argument must be >= 0 and <= than " + self.getTotalPlaybackTime());
                return;
            }
        }
    };
    
    /* Seek in the video. A negative number seeks backwards and a positive seeks forward */
    self.seek = function(time) {
        if (self.currentPlayer === null || self.currentVideo === null) {
            console.log("Player.seekTo(): currentPlayer or currentVideo is null");
            return;
        } else {
            time += self.getCurrentPlaybackTime();
            if (time <= 0) {
                self.seekTo(0);
            } else if (time >= self.getTotalPlaybackTime()) {
                self.seekTo(self.getTotalPlaybackTime());
            } else {
                self.seekTo(time);
            }
        }
    };
    
    /* Returns the current playback position in seconds */
    self.getCurrentPlaybackTime = function() {
        if (self.currentPlayer === null) {
            console.log("Player.getCurrentPlaybackTime(): currentPlayer is null");
            return 0;
        } else {
            return self.currentPlayer.getCurrentPlaybackTime();
        }
    };
    
    /* Returns the length of the video in seconds */
    self.getTotalPlaybackTime = function() {
        if (self.currentVideoLength) {
            return self.currentVideoLength;
        } else if (self.currentPlayer) {
            self.currentVideoLength = self.currentPlayer.getTotalPlaybackTime();
            return self.currentVideoLength;
        } else {
            console.log("Player.getTotalPlaybackTime(): currentPlayer is null");
            return 0;
        }
    };
    
    /* Find an alternative to the current video and play it */
    self.findAndPlayAlternative = function(video) {
        if (video.view) {
            video.view.addClass('alternative');
        }
        Search.findAlternative(video, function(alternative) {
            if (alternative) {
                self.play(alternative);
            } else {
                self.next();
            }
        });
    };

    /* Get the current playing video (if any) */
    self.getCurrentVideo = function() {
        return self.currentVideo;
    }
};