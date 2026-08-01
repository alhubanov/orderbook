use std::{collections::VecDeque};

const ARRAY_SIZE : usize = 130500;
pub struct HashTable<'a> 
{
    keys: [Option<&'a str>; ARRAY_SIZE],
    values: [Option<isize>; ARRAY_SIZE],
    update_history: VecDeque<(&'a str, isize)>
}

impl<'a> HashTable<'a>
{
    pub fn new() -> Self
    {
        HashTable { keys: [None; ARRAY_SIZE], values: [None; ARRAY_SIZE], update_history: VecDeque::new() }
    }

    pub fn insert(&mut self, key: &'a str, value: isize) -> ()
    {
        let pos = self.hash_with_probe(key);

        self.keys[pos] = Some(key);
        self.values[pos] = Some(value);

        self.update_history.retain(|(present_key, _)| *present_key != key);
        self.update_history.push_back((key, value));
    }

    pub fn remove(&mut self, key: &'a str) -> ()
    {
        let mut hash_pos : usize = self.hash_with_probe(key);

        if let None = self.keys[hash_pos]
        {
            return;
        }
        else 
        {
            self.keys[hash_pos] = None;
            self.values[hash_pos] = None;
        }

        let mut current_pos = hash_pos + 1;
        current_pos = current_pos % ARRAY_SIZE;

        while let Some(present_key) = self.keys[current_pos]
        {
            if Self::hash(present_key) < hash_pos
            {   
                self.keys[hash_pos] = Some(present_key);
                self.values[hash_pos] = self.values[current_pos];

                self.keys[current_pos] = None;
                self.values[current_pos] = None;

                hash_pos = current_pos;
            }

            current_pos += 1;
        }

        self.update_history.retain(|(present_key, _)| *present_key != key);
    }

    pub fn get(&self, key: &'a str) -> Option<isize>
    {
        let pos = self.hash_with_probe(key);
        self.values[pos]
    }

    pub fn get_last(&self) -> Option<&(&'a str, isize)> 
    {
        self.update_history.back()
    }

    pub fn get_first(&self) -> Option<&(&'a str, isize)> 
    {
        self.update_history.front()
    }

    fn hash(key: &str) -> usize
    {
        let mut pos : usize = 0;
        for character in key.chars()
        {
            pos += character as usize;
            pos = pos % ARRAY_SIZE; 
        }

        pos
    }

    fn hash_with_probe(&self, key: &str) -> usize
    {
        let mut pos : usize = Self::hash(key);
        while let Some(present_key) = self.keys[pos] && present_key != key
        {
            pos = pos + 1;
            pos = pos % ARRAY_SIZE;
        }

        pos
    }
}