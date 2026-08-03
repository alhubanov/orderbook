use std::{collections::VecDeque};

// TODO: fix/implement the derivations
#[derive(Clone, PartialEq, Debug)]
struct Entry<'a> 
{
    key: &'a str,
    value: isize
}

impl<'a> Entry<'a>
{
    fn create(key: &'a str, value: isize) -> Self
    {
        Entry { key, value }
    }
    
    fn get_key(&self) -> &'a str
    {
        self.key
    }

    fn get_value(&self) -> isize
    {
        self.value
    }
}

pub struct HashTable<'a> 
{
    capacity: usize,
    key_value_pairs: Vec<Option<Entry<'a>>>,
    update_history: VecDeque<(&'a str, isize)>
}

impl<'a> HashTable<'a>
{
    pub fn new(capacity: usize) -> Self
    {
        let mut key_value_pairs : Vec<Option<Entry<'a>>> = Vec::with_capacity(capacity);
        key_value_pairs.resize(capacity, None);

        HashTable 
        { 
            capacity: capacity, 
            key_value_pairs: key_value_pairs, 
            update_history: VecDeque::new() 
        }
    }

    pub fn insert(&mut self, key: &'a str, value: isize) -> ()
    {
        let pos = self.hash_with_probe(key);

        self.key_value_pairs[pos] = Some(Entry::create(key, value));

        self.update_history.retain(|(present_key, _)| *present_key != key);
        self.update_history.push_back((key, value));
    }

    pub fn remove(&mut self, key: &'a str) -> ()
    {
        let mut hash_pos : usize = self.hash_with_probe(key);

        if let None = self.key_value_pairs[hash_pos]
        {
            return;
        }
        else 
        {
            self.key_value_pairs[hash_pos] = None;
        }

        let mut current_pos = hash_pos + 1;
        current_pos = current_pos % self.capacity;

        while let Some(present_entry) = &self.key_value_pairs[current_pos]
        {
            let present_key = present_entry.get_key();
            let present_value = present_entry.get_value();
            if self.hash_with_probe(present_key) <= hash_pos
            {   
                self.key_value_pairs[hash_pos] = Some(Entry::create(present_key, present_value));
                self.key_value_pairs[current_pos] = None;

                hash_pos = current_pos;
            }

            current_pos += 1;
        }

        self.update_history.retain(|(present_key, _)| *present_key != key);
    }

    pub fn get(&self, key: &'a str) -> Option<isize>
    {
        let pos = self.hash_with_probe(key);
        self.key_value_pairs[pos]
            .as_ref()
            .and_then(|entry| Some(entry.get_value()))
    }

    pub fn get_last(&self) -> Option<&(&'a str, isize)> 
    {
        self.update_history.back()
    }

    pub fn get_first(&self) -> Option<&(&'a str, isize)> 
    {
        self.update_history.front()
    }

    fn hash(&self, key: &str) -> usize
    {
        let mut pos : usize = 0;
        for character in key.chars()
        {
            pos += character as usize;
            pos = pos % self.capacity; 
        }

        pos
    }

    fn hash_with_probe(&self, key: &str) -> usize
    {
        let mut pos : usize = self.hash(key);
        while let Some(present_entry) = &self.key_value_pairs[pos] && present_entry.get_key() != key
        {
            pos = pos + 1;
            pos = pos % self.capacity;
        }

        pos
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_insertion_and_update() 
    {
        let mut hash_table = HashTable::new(5);

        hash_table.insert("word", 1);

        assert_eq!(hash_table.key_value_pairs[hash_table.hash_with_probe("word")].as_ref().unwrap().get_key(), "word");
        assert_eq!(hash_table.key_value_pairs[hash_table.hash_with_probe("word")].as_ref().unwrap().get_value(), 1);

        hash_table.insert("word", 2);

        assert_eq!(hash_table.key_value_pairs[hash_table.hash_with_probe("word")].as_ref().unwrap().get_key(), "word");
        assert_eq!(hash_table.key_value_pairs[hash_table.hash_with_probe("word")].as_ref().unwrap().get_value(), 2);
    }

    #[test]
    fn test_hash()
    {
        let mut hash_table = HashTable::new(5);

        hash_table.insert("aaab", 1);
        hash_table.insert("aaba", 2);
        hash_table.insert("abaa", 3);

        assert_eq!(hash_table.hash("aaab"), hash_table.hash("aaba"));
        assert_eq!(hash_table.hash("aaab"), hash_table.hash("abaa"));
        assert_eq!((hash_table.hash_with_probe("aaab") + 1) % 5, hash_table.hash_with_probe("aaba"));
        assert_eq!((hash_table.hash_with_probe("aaab") + 2) % 5, hash_table.hash_with_probe("abaa"));
    }

    #[test]
    fn test_insertion_with_collision() 
    {
        let mut hash_table = HashTable::new(5);

        hash_table.insert("aaab", 1);
        hash_table.insert("aaba", 2);
        hash_table.insert("abaa", 3);

        let key1 = hash_table.hash_with_probe("aaab");

        assert_eq!(hash_table.key_value_pairs[key1].as_ref().unwrap().get_key(), "aaab");
        assert_eq!(hash_table.key_value_pairs[(key1 + 1) % 5].as_ref().unwrap().get_key(), "aaba");
        assert_eq!(hash_table.key_value_pairs[(key1 + 2) % 5].as_ref().unwrap().get_key(), "abaa");

        assert_eq!(hash_table.key_value_pairs[key1].as_ref().unwrap().get_value(), 1);
        assert_eq!(hash_table.key_value_pairs[(key1 + 1) % 5].as_ref().unwrap().get_value(), 2);
        assert_eq!(hash_table.key_value_pairs[(key1 + 2) % 5].as_ref().unwrap().get_value(), 3);
    }

    #[test]
    fn test_simple_removal() 
    {
        let mut hash_table = HashTable::new(5);

        hash_table.insert("word", 1);

        assert_eq!(hash_table.key_value_pairs[hash_table.hash_with_probe("word")].as_ref().unwrap().get_key(), "word");
        assert_eq!(hash_table.key_value_pairs[hash_table.hash_with_probe("word")].as_ref().unwrap().get_value(), 1);

        hash_table.remove("word");

        assert_eq!(hash_table.key_value_pairs[hash_table.hash_with_probe("word")], None);

        hash_table.remove("word");

        assert_eq!(hash_table.key_value_pairs[hash_table.hash_with_probe("word")], None);
    }

    #[test]
    fn test_removal_given_probe() 
    {
        let mut hash_table = HashTable::new(5);

        hash_table.insert("aaab", 1);
        hash_table.insert("aaba", 2);
        hash_table.insert("abaa", 3);
        hash_table.insert("baaa", 4);

        let key1 = hash_table.hash_with_probe("aaab");

        assert_eq!(hash_table.key_value_pairs[key1].as_ref().unwrap().get_key(), "aaab");
        assert_eq!(hash_table.key_value_pairs[(key1 + 1) % 5].as_ref().unwrap().get_key(), "aaba");
        assert_eq!(hash_table.key_value_pairs[(key1 + 2) % 5].as_ref().unwrap().get_key(), "abaa");
        assert_eq!(hash_table.key_value_pairs[(key1 + 3) % 5].as_ref().unwrap().get_key(), "baaa");

        hash_table.remove("aaba");

        assert_eq!(hash_table.key_value_pairs[key1].as_ref().unwrap().get_key(), "aaab");
        assert_eq!(hash_table.key_value_pairs[(key1 + 1) % 5].as_ref().unwrap().get_key(), "abaa");
        assert_eq!(hash_table.key_value_pairs[(key1 + 2) % 5].as_ref().unwrap().get_key(), "baaa");
        assert_eq!(hash_table.key_value_pairs[(key1 + 3) % 5], None);


        hash_table.remove("aaab");

        assert_eq!(hash_table.key_value_pairs[key1].as_ref().unwrap().get_key(), "abaa");
        assert_eq!(hash_table.key_value_pairs[(key1 + 1) % 5].as_ref().unwrap().get_key(), "baaa");
        assert_eq!(hash_table.key_value_pairs[(key1 + 2) % 5], None);
        assert_eq!(hash_table.key_value_pairs[(key1 + 3) % 5], None);

    }

    #[test]
    fn test_get() 
    {
        let mut hash_table = HashTable::new(5);

        assert_eq!(hash_table.get("anything"), None);

        hash_table.insert("word", 2);
        assert_eq!(hash_table.get("word"), Some(2));

        hash_table.remove("word");
        assert_eq!(hash_table.get("word"), None);

        hash_table.insert("aaab", 1);
        hash_table.insert("aaba", 2);
        hash_table.insert("abaa", 3);
        hash_table.insert("baaa", 4);

        hash_table.remove("aaba");
        assert_eq!(hash_table.get("aaba"), None);
        assert_eq!(hash_table.get("aaab"), Some(1));
        assert_eq!(hash_table.get("abaa"), Some(3));
        assert_eq!(hash_table.get("baaa"), Some(4));
    }

    #[test]
    fn test_get_first_and_last() 
    {
        let mut hash_table = HashTable::new(5);

        assert_eq!(hash_table.get_first(), None);
        assert_eq!(hash_table.get_last(), None);

        hash_table.insert("aaab", 1);
        hash_table.insert("aaba", 2);
        hash_table.insert("abaa", 3);
        hash_table.insert("baaa", 4);

        assert_eq!(hash_table.get_first(), Some(&("aaab", 1)));
        assert_eq!(hash_table.get_last(), Some(&("baaa", 4)));

        hash_table.remove("aaab");

        assert_eq!(hash_table.get_first(), Some(&("aaba", 2)));
        assert_eq!(hash_table.get_last(), Some(&("baaa", 4)));

        hash_table.remove("baaa");

        assert_eq!(hash_table.get_first(), Some(&("aaba", 2)));
        assert_eq!(hash_table.get_last(), Some(&("abaa", 3)));

        hash_table.insert("aaba", 5);

        assert_eq!(hash_table.get_first(), Some(&("abaa", 3)));
        assert_eq!(hash_table.get_last(), Some(&("aaba", 5)));
    }
}