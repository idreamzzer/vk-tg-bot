import https from 'https';
import fs from 'fs';
import youtubeDlExec from 'youtube-dl-exec';
import { FileInfo } from '@yc-bot/types';
import path from 'path';
import { extension } from 'mime-types';
import ytdl from 'ytdl-core';
import pathToFfmpeg from 'ffmpeg-static';
import child_process from 'child_process';
import { promisify } from 'util';
promisify(child_process.exec);
const exec = child_process.exec;

export const downloadFile = async (fileUrl: string, saveTo: string, filename: string | number): Promise<FileInfo> => {
	return new Promise((resolve, reject) => {
		const request = https.get(fileUrl, async (resp) => {
			if (resp.headers.location && resp.statusCode === 302) {
				resolve(await downloadFile(resp.headers.location, saveTo, String(filename)));
			}
			if (resp.statusCode === 200) {
				const size = Math.ceil(parseInt(resp.headers['content-length'], 10) / 1024); // kb
				const mime = resp.headers['content-type'];
				const ext = extension(mime);
				const filePath = path.join(saveTo, `${filename}.${ext}`);

				if (size > 51200) reject(`File is bigger than 50MB. Expected less than 50MB. Current size is ${size / 1024}MB`);

				const fileStream = fs.createWriteStream(filePath);
				resp.pipe(fileStream);

				const fileInfo: FileInfo = {
					mime,
					size,
					path: filePath,
					filename,
					ext,
					buffer: ''
				};
				fileStream.on('finish', () => {
					fileStream.close();
					fileInfo.buffer = fs.createReadStream(filePath);
					resolve(fileInfo);
				});
				request.on('error', (err) => {
					reject(err);
				});
				fileStream.on('error', (err) => {
					reject(err);
				});
				request.end();
			} else {
				reject('Unknown error in file downloading');
			}
		});
	});
};

export const downloadVideo = async (videoUrl: string, saveTo: string, filename: string | number): Promise<FileInfo | null> => {
	let filePath = path.join(saveTo, `${filename}.mp4`);
	let fileInfo: FileInfo = null;
	const result = await youtubeDlExec(videoUrl, {
		dumpJson: true,
		format: '(mp4)[height<=640][height>=360][width<=640][width>=360]'
	});
	if (result.duration > 600) {
		throw `Video is longer than 10 minutes. "${result.fulltitle ?? ''}" ${result.webpage_url ?? ''} `;
	}
	if (result.extractor === 'youtube') {
		await downloadYoutubeVideo(result.webpage_url, saveTo, filename);
	} else {
		await youtubeDlExec(videoUrl, {
			output: filePath,
			format: '(mp4)[height<=640][height>=360][width<=640][width>=360]'
		});
		filePath = await convertVideoToMP4(filePath);
	}

	const size = Math.round(fs.statSync(filePath).size / 1024); // kb
	if (size > 51200) {
		throw `Video size is bigger than 50MB. Expected less than 50MB. Current size is ${size / 1024}MB. "${result.fulltitle ?? ''}" ${
			result.webpage_url ?? ''
		} `;
	}
	const [name, ext] = path.basename(filePath).split('.');
	fileInfo = {
		ext,
		filename: name,
		mime: '',
		path: filePath,
		size,
		buffer: fs.createReadStream(filePath),
		duration: result.duration,
		height: result.height,
		width: result.width,
		thumb: result.thumbnail
	};
	return fileInfo;
};

export const downloadYoutubeVideo = (videoUrl: string, saveTo: string, filename: string | number): Promise<void> => {
	return new Promise((resolve, reject) => {
		const filePath = path.join(saveTo, `${filename}.mp4`);
		const fileStream = fs.createWriteStream(filePath);
		const video = ytdl(videoUrl);
		video.pipe(fileStream);
		video.on('error', (err) => reject(err));
		video.on('end', () => {
			resolve();
		});
	});
};

export const convertVideoToMP4 = async (fileLocation: string): Promise<string> => {
	return new Promise((resolve, reject) => {
		const convertedFileLocation = path.join(path.dirname(fileLocation), `c-${path.basename(fileLocation).split('.')[0]}.mp4`);
		exec(`"${pathToFfmpeg}" -i ${fileLocation} -codec:v libx264 -preset veryfast ${convertedFileLocation}`, (err) => {
			if (err) reject(err);
			resolve(convertedFileLocation);
		});
	});
};
