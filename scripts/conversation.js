/*
 * Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
(function(lexaudio) {
  'use strict';

  function example() {

    var lexruntime, params,
      message = document.getElementById('message'),
      audioControl = lexaudio.audioControl(),
      renderer = lexaudio.renderer(),
      uploadBucketName = 'tensorflow-audio-training-data',
      bucketRegion = 'us-east-1',
      IdentityPoolId = 'us-east-1:88da0e8d-a30a-4704-b284-4476f0336f6b',
      done = "Thanks, that's all the words for now";
      
      AWS.config.update({
        region: bucketRegion,
        credentials: new AWS.CognitoIdentityCredentials({
          IdentityPoolId: IdentityPoolId
        })
      });
      
      var s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        params: {Bucket: uploadBucketName}
      });
      s3.getBucketLocation();
      
    var Conversation = function(messageEl) {
      var message, audioInput, audioOutput, currentState;

      this.messageEl = messageEl;

      this.renderer = renderer;
      this.words = [
        "Hello",
        "Alexa",
        "Extra",
        "Agenda",
        "Alexis",
        "Banana",
        "Alexa_",
        "Umbrella",
        "Election",
        "Elsa",
        "Agenda_",
        "Vanilla",
        "Extra_",
        "Alexa__",
        "Dyslexic",
        "Alexis_",
        "Election_",
        "The next one",
        "A texan",    
        "Alexa___"
      ];
      this.wordIndex = this.words.length-1;
      this.iteration = 0;
      var self = this;
      this.messages = Object.freeze({
        PASSIVE: function() { 
          if(self.wordIndex+1 == self.words.length) {
            self.wordIndex = 0;
          } else {
            self.wordIndex++;            
          }
          var word = self.words[self.wordIndex];
          for (var i = 0; i < self.iteration; i++) {
            word = word + "_";          
          }
          return word;
        },
        LISTENING: 'Listening...',
        SENDING: 'Sending...',
        SPEAKING: 'Speaking...'
      });

      this.onSilence = function() {
        audioControl.stopRecording();
        currentState.state.renderer.clearCanvas();
        currentState.advanceConversation();
      };

      this.transition = function(conversation) {
        currentState = conversation;
        var state = currentState.state;
        messageEl.textContent = state.message;
        if (state.message === state.messages.SENDING) {
          currentState.advanceConversation();
        } else if (state.message === state.messages.SPEAKING) {
          currentState.advanceConversation();
        }
      };

      this.advanceConversation = function() {
        currentState.advanceConversation();
      };

      currentState = new Initial(this);
    }

    var Initial = function(state) {
      this.state = state;
      audioControl.clear();
      
      var word = state.messages.PASSIVE();
      state.word = word.replace(/_/g,"");
      state.suffix = word.replace(/[^_]/g,"");
      if(state.word == done) {
        var button = document.getElementById('audio-control');
        button.parentNode.removeChild(button);
      }
      state.message = state.word;
      this.advanceConversation = function() {
        if(state.word != done) {
          state.renderer.prepCanvas();
          audioControl.startRecording(state.onSilence, state.renderer.visualizeAudioBuffer);
          state.transition(new Listening(state));
        }
      }
    };

    var Listening = function(state) {
      this.state = state;
      state.message = state.messages.LISTENING;
      this.advanceConversation = function() {
        audioControl.exportWAV(function(blob) {
          state.audioInput = blob;
          state.transition(new Sending(state));
        });
      }
    };

    var Sending = function(state) {
      this.state = state;
      state.message = state.messages.SENDING;
      this.advanceConversation = function() {
        s3.upload({
          Key: state.word.replace(/ /g, "_") + "/" + AWS.config.credentials.accessKeyId + state.suffix + ".wav",
          Body: state.audioInput,
          ACL: 'bucket-owner-full-control'
        }, function(err, data) {
          if (err) {
            return alert('There was an error uploading your audio: ', err.message);
          }
          state.transition(new Initial(state));
        });
      }
    };

    var Speaking = function(state) {
      this.state = state;
      state.message = state.messages.SPEAKING;
      this.advanceConversation = function() {
        if (state.audioOutput.contentType === 'audio/mpeg') {
          audioControl.play(state.audioOutput.audioStream, function() {
            state.renderer.prepCanvas();
            audioControl.startRecording(state.onSilence, state.renderer.visualizeAudioBuffer);
            state.transition(new Listening(state));
          });
        } else if (state.audioOutput.dialogState === 'ReadyForFulfillment') {
          state.transition(new Initial(state));
        }
      }
    };

    audioControl.supportsAudio(function(supported) {
      if (supported) {
        var conversation = new Conversation(message);
        message.textContent = conversation.message;
        document.getElementById('audio-control').onclick = function() {
          conversation.advanceConversation();
        };
      } else {
        message.textContent = 'Audio capture is not supported.';
      }
    });
  }
  lexaudio.example = example;
})(lexaudio);
