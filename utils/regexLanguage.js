export const generateVietnameseRegex = (keyword) => {
  const charMap = {
    'a': '[aàáạảãâầấậẩẫăằắặẳẵ]',
    'e': '[eèéẹẻẽêềếệểễ]',
    'i': '[iìíịỉĩ]',
    'o': '[oòóọỏõôồốộổỗơờớợởỡ]',
    'u': '[uùúụủũưừứựửữ]',
    'y': '[yỳýỵỷỹ]',
    'd': '[dđ]',
  };
  
  const pattern = keyword.toLowerCase().split('').map(char => charMap[char] || char).join('');
  return new RegExp(pattern, 'i');
};