import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../libs/supabase';

const SAF = FileSystem.StorageAccessFramework;
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
const CHUNK = 6000;
const MAX_LIST = 200;
const LOCAL_PROVIDER = 'content://com.android.externalstorage.documents/';

const TEXT_EXTENSIONS = [
  'txt', 'md', 'log', 'csv', 'tsv',
  'json', 'xml', 'yaml', 'yml', 'ini', 'conf',
  'html', 'htm', 'css', 'scss',
  'js', 'jsx', 'ts', 'tsx', 'py', 'sh', 'bat',
];

const DOC_EXTENSIONS = ['pdf', 'docx'];

const MIME = {
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  html: 'text/html',
  xml: 'text/xml',
};

const DOC_MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const textCache = new Map();

export async function pickFolder() {
  const perm = await SAF.requestDirectoryPermissionsAsync();
  if (!perm.granted) return null;
  if (!perm.directoryUri.startsWith(LOCAL_PROVIDER)) {
    Alert.alert(
      'Choose a local folder',
      'Pick a folder from Internal storage, not Google Drive or another cloud app.'
    );
    return null;
  }
  return perm.directoryUri;
}

export const saveFolder = (agentId, uri) =>
  AsyncStorage.setItem(`agent_folder:${agentId}`, uri);

export const getFolder = async (agentId) => {
  const key = `agent_folder:${agentId}`;
  const uri = await AsyncStorage.getItem(key);
  if (!uri) return null;
  if (!uri.startsWith(LOCAL_PROVIDER)) {
    await AsyncStorage.removeItem(key);
    return null;
  }
  return uri;
};

const getExt = (name) =>
  name.includes('.') ? name.split('.').pop().toLowerCase() : '';

export const getName = (fileUri) => {
  const decoded = decodeURIComponent(fileUri);
  let fileName = decoded.split('/').pop();
  if (fileName.includes(':')) fileName = fileName.split(':').pop();
  return { fileName, extension: getExt(fileName) };
};

async function listEntries(folderUri) {
  const uris = await SAF.readDirectoryAsync(folderUri);
  return uris.map((uri) => {
    const { fileName, extension } = getName(uri);
    return { uri, name: fileName, extension };
  });
}

export const list_files = async (agentId) => {
  const folderUri = await getFolder(agentId);
  if (!folderUri) return [];
  return listEntries(folderUri);
};

export async function listFileNames(agentId) {
  const entries = await list_files(agentId);
  return entries.slice(0, MAX_LIST).map((e) => ({ name: e.name, type: e.extension }));
}

export async function getFileUri(agentId, fileName) {
  const files = await list_files(agentId);
  const match = files.find((f) => f.name === fileName);
  return match ? match.uri : null;
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return token;
}

async function extractDocText(fileUri, name, extension) {
  const token = await getToken();
  const cachePath = `${FileSystem.cacheDirectory}${Date.now()}_${name.replace(/[^\w.-]/g, '_')}`;
  await FileSystem.copyAsync({ from: fileUri, to: cachePath });

  try {
    const res = await FileSystem.uploadAsync(`${API_URL}/api/content/extract`, cachePath, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: DOC_MIME[extension],
      parameters: { name },
      headers: { Authorization: `Bearer ${token}` },
    });

    let body = {};
    try {
      body = JSON.parse(res.body);
    } catch {
      body = {};
    }
    if (res.status !== 200) throw new Error(body.error || `Extract failed: ${res.status}`);
    return body.text || '';
  } finally {
    await FileSystem.deleteAsync(cachePath, { idempotent: true });
  }
}

async function generateDocBase64(name, content) {
  const token = await getToken();
  const response = await fetch(`${API_URL}/api/db/generate-doc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, content }),
  });

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  if (!response.ok) throw new Error(body.error || `Create failed: ${response.status}`);
  return body.base64;
}

export const read_normal_text = async (extension, fileUri, name = '') => {
  const isText = TEXT_EXTENSIONS.includes(extension);
  const isDoc = DOC_EXTENSIONS.includes(extension);
  if (!isText && !isDoc) return null;
  if (textCache.has(fileUri)) return textCache.get(fileUri);

  const content = isText
    ? await SAF.readAsStringAsync(fileUri)
    : await extractDocText(fileUri, name, extension);

  textCache.set(fileUri, content);
  return content;
};

export async function runFolderTool(folderUri, call) {
  try {
    if (!folderUri) return JSON.stringify({ error: 'No folder selected' });
    const args = call.args || {};
    const entries = await listEntries(folderUri);

    if (call.name === 'list_files') {
      return JSON.stringify(entries.map((e) => ({ name: e.name, type: e.extension })));
    }

    if (call.name === 'read_file') {
      const wanted = String(args.name || '');
      const file =
        entries.find((e) => e.name === wanted) ||
        entries.find((e) => e.name.toLowerCase() === wanted.toLowerCase());
      if (!file) {
        return JSON.stringify({ error: 'File not found. Use an exact name from the file list.' });
      }

      const text = await read_normal_text(file.extension, file.uri, file.name);
      if (text === null) {
        return JSON.stringify({ error: `Unsupported file type: ${file.extension || 'none'}` });
      }
      if (!text.trim()) {
        return JSON.stringify({
          error: 'No readable text in this file. It may be a scanned document or contain only images.',
        });
      }

      const start = Math.max(0, Number(args.offset) || 0);
      const end = start + CHUNK;
      return JSON.stringify({
        name: file.name,
        text: text.slice(start, end),
        more: end < text.length,
        next_offset: end < text.length ? end : null,
        total_chars: text.length,
      });
    }

    if (call.name === 'create_file') {
      const name = String(args.name || '').trim();
      const content = String(args.content ?? '');
      if (!name) return JSON.stringify({ error: 'File name is required' });

      const ext = getExt(name);
      const isText = TEXT_EXTENSIONS.includes(ext);
      const isDoc = DOC_EXTENSIONS.includes(ext);
      if (!isText && !isDoc) {
        return JSON.stringify({ error: `Unsupported file type: ${ext || 'none'}` });
      }
      if (entries.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
        return JSON.stringify({ error: 'A file with this name already exists' });
      }

      if (isText) {
        const uri = await SAF.createFileAsync(folderUri, name, MIME[ext] || 'text/plain');
        await SAF.writeAsStringAsync(uri, content);
        textCache.delete(uri);
        return JSON.stringify({ created: name, chars: content.length });
      }

      const base64 = await generateDocBase64(name, content);
      const uri = await SAF.createFileAsync(folderUri, name, DOC_MIME[ext]);
      await SAF.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      textCache.delete(uri);
      return JSON.stringify({ created: name, chars: content.length });
    }

    return JSON.stringify({ error: 'Unknown tool' });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}