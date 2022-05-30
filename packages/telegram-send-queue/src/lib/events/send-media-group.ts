import { FileInfo, Files, ImageInfo, InputMediaAudio, InputMediaDocument, Post, TelegramSendEvent, VideoInfo } from '@yc-bot/types';
import { chunkString } from '@yc-bot/utils';
import { InputMediaPhoto, InputMediaVideo, SendMediaGroupOptions, SendMessageOptions } from 'node-telegram-bot-api';

const MAX_TEXT_LENGTH = 4096;
const CAPTION_TEXT_LENGTH = 1024;

export const sendMediaGroup = (text: string, mediaFiles: Files): TelegramSendEvent[] => {
	const events = [] as TelegramSendEvent[];
	if (!mediaFiles?.length) return events;
	mediaFiles = mediaFiles.slice(0, 10);
	const mediaGroup = [];
	mediaFiles.forEach((file) => {
		// Составляем элемент для очереди
		if (file.type === 'photo') {
			const { path } = file as ImageInfo;
			const mediaEl = {
				type: 'photo',
				media: path
			} as InputMediaPhoto;
			mediaGroup.push(mediaEl);
		} else if (file.type === 'video') {
			const { duration, width, height, path } = file as VideoInfo;
			const mediaEl = {
				type: 'video',
				media: path,
				supports_streaming: true,
				duration,
				width,
				height
			} as InputMediaVideo;
			mediaGroup.push(mediaEl);
		} else if (file.type === 'document') {
			const { path } = file as FileInfo;
			const mediaEl = {
				type: 'document',
				media: path
			} as InputMediaDocument;
			mediaGroup.push(mediaEl);
		}
		// } else if (file.type === 'audio') {
		// 	const { duration, title, path, artist } = file as AudioInfo;
		// 	const mediaEl = {
		// 		type: 'audio',
		// 		media: path,
		// 		duration,
		// 		performer: artist
		// 	} as InputMediaAudio;
		// 	event.payload.content.media.push(mediaEl);
		// }
	});
	const event = {
		payload: {
			content: {
				media: mediaGroup
			},
			options: {
				disable_notification: true
			} as SendMediaGroupOptions
		},
		method: 'sendMediaGroup'
	} as TelegramSendEvent;
	events.push(event);

	if (text) {
		const [firstText, ...restText] = chunkString(text, MAX_TEXT_LENGTH, CAPTION_TEXT_LENGTH);
		events[0].payload.content.media[0].caption = firstText ?? '';
		if (restText?.length) {
			for (const textChunk of restText) {
				const event = {
					payload: {
						content: {
							text: textChunk
						},
						options: {
							disable_notification: true
						} as SendMessageOptions
					},
					method: 'sendMessage'
				} as TelegramSendEvent;
				events.push(event);
			}
		}
	}

	return events;
};
