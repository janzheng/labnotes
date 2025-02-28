import { typeCAction } from './canvas/typeC-actions';
import { 
    chatAction, 
    generateImageAction,
    threadgirlAction,
   } from './canvas/chat-actions';

export const server = {
  canvas: {
    typeC: typeCAction,
    chat: chatAction,
    generateImage: generateImageAction,
    threadgirl: threadgirlAction
  }
}; 