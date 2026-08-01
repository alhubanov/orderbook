use std::collections::{VecDeque};

struct HashTable<'a> 
{
    keys: [String; 13],
    values: [i32; 13],
    history: VecDeque<(&'a String, i32)>
}

impl<'a> HashTable<'a>
{
    pub fn new() -> Self
    {

    }

    pub fn insert(&mut self, key: String, value: i32) -> ()
    {

    }

    pub fn remove(&mut self, key: String) -> ()
    {

    }

    pub fn get(&self, key: String) -> i32
    {

    }

    pub fn get_last(&self) -> (&String, i32) 
    {

    }

    pub fn get_first(&self) -> (&String, i32) 
    {

    }

    fn hash(key: String) -> u32 
    {

    } 

}