// TODO: fix/implement the derivations
#[derive(Clone, PartialEq, Debug)]
struct Entry<'a> 
{
    key: &'a str,
    value: isize,
    prev_idx: Option<usize>,
    next_idx: Option<usize>
}

impl<'a> Entry<'a>
{
    fn create(key: &'a str, value: isize, prev_idx: Option<usize>) -> Self
    {
        Entry { key, value, prev_idx, next_idx: None }
    }
    
    fn get_key(&self) -> &'a str
    {
        self.key
    }

    fn get_value(&self) -> isize
    {
        self.value
    }

    fn update_prev_idx(&mut self, update: Option<usize>) -> ()
    {
        self.prev_idx = update;
    }

    fn update_next_idx(&mut self, update: Option<usize>) -> ()
    {
        self.next_idx = update;
    }

    fn get_prev_idx(&self) -> Option<usize>
    {
        self.prev_idx
    }

    fn get_next_idx(&self) -> Option<usize>
    {
        self.next_idx
    }  
}

pub struct HashTable<'a> 
{
    capacity: usize,
    hash_storage: Vec<Option<usize>>,
    key_value_pairs: Vec<Option<Entry<'a>>>,
    last_updated_idx: Option<usize>,
    first_updated_idx: Option<usize>,
    next_free_slot_idx: usize,
    free_list: Vec<usize>
}

impl<'a> HashTable<'a>
{
    pub fn new(capacity: usize) -> Self
    {
        let mut hash_storage : Vec<Option<usize>> = Vec::with_capacity(capacity);
        hash_storage.resize(capacity, None);

        let mut key_value_pairs : Vec<Option<Entry<'a>>> = Vec::with_capacity(capacity);
        key_value_pairs.resize(capacity, None);

        HashTable 
        { 
            capacity, 
            hash_storage,
            key_value_pairs, 
            last_updated_idx: None,
            first_updated_idx: None,
            next_free_slot_idx: 0,
            free_list: Vec::new()
        }
    }

    pub fn insert(&mut self, key: &'a str, value: isize) -> ()
    {
        let hash_pos = self.hash_with_probe(key);
        match self.hash_storage[hash_pos] 
        {
            None => 
            {
                let mut increment_next_free_slot_idx = false;
                let idx_to_occupy = self.free_list.pop().unwrap_or_else(|| { increment_next_free_slot_idx = true; self.next_free_slot_idx });

                self.hash_storage[hash_pos] = Some(idx_to_occupy);
                self.key_value_pairs[idx_to_occupy] = Some(Entry::create(key, value, self.last_updated_idx));

                if let Some(idx) = self.last_updated_idx
                {
                    self.key_value_pairs[idx].as_mut().unwrap().update_next_idx(Some(idx_to_occupy));
                }
                self.last_updated_idx = Some(idx_to_occupy);

                if self.first_updated_idx.is_none()
                {
                    self.first_updated_idx = Some(idx_to_occupy);
                }

                if increment_next_free_slot_idx { self.next_free_slot_idx += 1 };
            },
            Some(slot_idx) => 
            {
                let prev_idx = self.key_value_pairs[slot_idx].as_ref().unwrap().get_prev_idx();
                let next_idx = self.key_value_pairs[slot_idx].as_ref().unwrap().get_next_idx();

                match prev_idx
                {
                    // if there is a present entry, but there was no value for prev_idx, then this entry must have been first
                    None => self.first_updated_idx = next_idx,
                    Some(idx) => 
                    {
                        // unwrap is safe here because otherwise prev_idx would not have been Some(_)
                        self.key_value_pairs[idx].as_mut().unwrap().update_next_idx(next_idx);
                    }
                }

                match next_idx
                {
                    None => (),
                    Some(idx) => 
                    {
                        // unwrap is safe here because otherwise next_idx would not have been Some(_)
                        self.key_value_pairs[idx].as_mut().unwrap().update_prev_idx(prev_idx);
                    }
                }

                self.key_value_pairs[slot_idx] = Some(Entry::create(key, value, self.last_updated_idx));
                self.last_updated_idx = Some(slot_idx);
            }
        }
    }

    pub fn remove(&mut self, key: &'a str) -> ()
    {
        let mut hash_pos : usize = self.hash_with_probe(key);

        match self.hash_storage[hash_pos] 
        {
            None => return,
            Some(slot_idx) => 
            {
                let prev_idx = self.key_value_pairs[slot_idx].as_ref().unwrap().get_prev_idx();
                let next_idx = self.key_value_pairs[slot_idx].as_ref().unwrap().get_next_idx();

                match prev_idx
                {
                    None => self.first_updated_idx = next_idx,
                    Some(idx) => 
                    {
                        // unwrap is safe here because otherwise prev_idx would not have been Some(_)
                        self.key_value_pairs[idx].as_mut().unwrap().update_next_idx(next_idx);
                    }
                }

                match next_idx
                {
                    None => self.last_updated_idx = prev_idx,
                    Some(idx) => 
                    {
                        // unwrap is safe here because otherwise next_idx would not have been Some(_)
                        self.key_value_pairs[idx].as_mut().unwrap().update_prev_idx(prev_idx);
                    }
                }

                self.free_list.push(slot_idx);
                self.key_value_pairs[slot_idx] = None;
                self.hash_storage[hash_pos] = None;
            } 
        }

        let mut current_pos = hash_pos + 1;
        current_pos = current_pos % self.capacity;

        while let Some(entry_idx) = self.hash_storage[current_pos]
        {
            let present_key = self.key_value_pairs[entry_idx].as_ref().unwrap().get_key();

            if self.hash_with_probe(present_key) <= hash_pos
            {   
                self.hash_storage[hash_pos] = Some(entry_idx);
                self.hash_storage[current_pos] = None;

                hash_pos = current_pos;
            }

            current_pos += 1;
        }
    }

    pub fn get(&self, key: &'a str) -> Option<isize>
    {
        let pos = self.hash_with_probe(key);
        
        self.hash_storage[pos]
            .and_then(|slot_idx| Some(self.key_value_pairs[slot_idx]
                                          .as_ref()
                                          .unwrap()
                                          .get_value()
                                     ) 
                     )
    }

    pub fn get_last(&self) -> Option<(&'a str, isize)> 
    {
        self.last_updated_idx
            .and_then(|slot_idx| self.key_value_pairs[slot_idx]
                                     .as_ref()
                                     .map(|present_entry| (present_entry.get_key(), present_entry.get_value()))
                     )
    }

    pub fn get_first(&self) -> Option<(&'a str, isize)> 
    {
        self.first_updated_idx
            .and_then(|slot_idx| self.key_value_pairs[slot_idx]
                                     .as_ref()
                                     .map(|present_entry| (present_entry.get_key(), present_entry.get_value()))
                     )
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
        while let Some(present_entry_idx) = &self.hash_storage[pos] && self.key_value_pairs[*present_entry_idx].as_ref().unwrap().get_key() != key
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

        let slot_idx = hash_table.hash_storage[hash_table.hash_with_probe("word")].unwrap();

        assert_eq!(hash_table.key_value_pairs[slot_idx].as_ref().unwrap().get_key(), "word");
        assert_eq!(hash_table.key_value_pairs[slot_idx].as_ref().unwrap().get_value(), 1);

        hash_table.insert("word", 2);

        assert_eq!(hash_table.key_value_pairs[slot_idx].as_ref().unwrap().get_key(), "word");
        assert_eq!(hash_table.key_value_pairs[slot_idx].as_ref().unwrap().get_value(), 2);
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

        let pos = hash_table.hash_with_probe("aaab");

        let key1 = hash_table.hash_storage[pos].unwrap();
        let key2 = hash_table.hash_storage[(pos + 1) % 5].unwrap();
        let key3 = hash_table.hash_storage[(pos + 2) % 5].unwrap();

        assert_eq!(hash_table.key_value_pairs[key1].as_ref().unwrap().get_key(), "aaab");
        assert_eq!(hash_table.key_value_pairs[key2].as_ref().unwrap().get_key(), "aaba");
        assert_eq!(hash_table.key_value_pairs[key3].as_ref().unwrap().get_key(), "abaa");

        assert_eq!(hash_table.key_value_pairs[key1].as_ref().unwrap().get_value(), 1);
        assert_eq!(hash_table.key_value_pairs[key2].as_ref().unwrap().get_value(), 2);
        assert_eq!(hash_table.key_value_pairs[key3].as_ref().unwrap().get_value(), 3);
    }

    #[test]
    fn test_simple_removal() 
    {
        let mut hash_table = HashTable::new(5);

        hash_table.insert("word", 1);

        let slot_idx = hash_table.hash_storage[hash_table.hash_with_probe("word")].unwrap();

        assert_eq!(hash_table.key_value_pairs[slot_idx].as_ref().unwrap().get_key(), "word");
        assert_eq!(hash_table.key_value_pairs[slot_idx].as_ref().unwrap().get_value(), 1);

        hash_table.remove("word");

        assert_eq!(hash_table.key_value_pairs[slot_idx], None);

        hash_table.remove("word");

        assert_eq!(hash_table.key_value_pairs[slot_idx], None);
    }

    #[test]
    fn test_removal_given_probe() 
    {
        let mut hash_table = HashTable::new(5);

        hash_table.insert("aaab", 1);
        hash_table.insert("aaba", 2);
        hash_table.insert("abaa", 3);
        hash_table.insert("baaa", 4);

        let pos = hash_table.hash_with_probe("aaab");

        let key1 = hash_table.hash_storage[pos].unwrap();
        let key2 = hash_table.hash_storage[(pos + 1) % 5].unwrap();
        let key3 = hash_table.hash_storage[(pos + 2) % 5].unwrap();
        let key4 = hash_table.hash_storage[(pos + 3) % 5].unwrap();

        assert_eq!(hash_table.key_value_pairs[key1].as_ref().unwrap().get_key(), "aaab");
        assert_eq!(hash_table.key_value_pairs[key2].as_ref().unwrap().get_key(), "aaba");
        assert_eq!(hash_table.key_value_pairs[key3].as_ref().unwrap().get_key(), "abaa");
        assert_eq!(hash_table.key_value_pairs[key4].as_ref().unwrap().get_key(), "baaa");

        hash_table.remove("aaba");

        assert_eq!(hash_table.key_value_pairs[hash_table.hash_storage[pos].unwrap()].as_ref().unwrap().get_key(), "aaab");
        assert_eq!(hash_table.key_value_pairs[hash_table.hash_storage[(pos + 1) % 5].unwrap()].as_ref().unwrap().get_key(), "abaa");
        assert_eq!(hash_table.key_value_pairs[hash_table.hash_storage[(pos + 2) % 5].unwrap()].as_ref().unwrap().get_key(), "baaa");
        assert_eq!(hash_table.hash_storage[(pos + 3) % 5], None);

        hash_table.remove("aaab");

        assert_eq!(hash_table.key_value_pairs[hash_table.hash_storage[pos].unwrap()].as_ref().unwrap().get_key(), "abaa");
        assert_eq!(hash_table.key_value_pairs[hash_table.hash_storage[(pos + 1) % 5].unwrap()].as_ref().unwrap().get_key(), "baaa");
        assert_eq!(hash_table.hash_storage[(pos + 2) % 5], None);
        assert_eq!(hash_table.hash_storage[(pos + 3) % 5], None);
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

        assert_eq!(hash_table.get_first(), Some(("aaab", 1)));
        assert_eq!(hash_table.get_last(), Some(("baaa", 4)));

        hash_table.remove("aaab");

        assert_eq!(hash_table.get_first(), Some(("aaba", 2)));
        assert_eq!(hash_table.get_last(), Some(("baaa", 4)));

        hash_table.remove("baaa");

        assert_eq!(hash_table.get_first(), Some(("aaba", 2)));
        assert_eq!(hash_table.get_last(), Some(("abaa", 3)));

        hash_table.insert("aaba", 5);

        assert_eq!(hash_table.get_first(), Some(("abaa", 3)));
        assert_eq!(hash_table.get_last(), Some(("aaba", 5)));
    }
}